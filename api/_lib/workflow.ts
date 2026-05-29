import { appBaseDomain } from "./env";

function yamlQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function apiBaseUrl() {
  return process.env.SHELBY_APP_URL || `https://${appBaseDomain()}`;
}

export const GITHUB_DEPLOY_SECRET_NAME = "SHELBYHOST_DEPLOY_TOKEN";
export const GITHUB_WORKFLOW_FILE = ".github/workflows/shelbyhost-deploy.yml";

export function githubWorkflowYaml({
  slug,
  branch,
  buildCommand = "npm run build",
  buildOutput = "dist",
}: {
  slug: string;
  branch: string;
  buildCommand?: string;
  buildOutput?: string;
}) {
  return `name: ShelbyHost Deploy

on:
  push:
    branches: [${yamlQuote(branch)}]
  workflow_dispatch:

permissions:
  contents: read

env:
  SHELBYHOST_API_URL: ${yamlQuote(apiBaseUrl())}
  SHELBYHOST_PROJECT_SLUG: ${yamlQuote(slug)}
  SHELBYHOST_BUILD_OUTPUT: ${yamlQuote(buildOutput)}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then
            npm ci
          elif [ -f pnpm-lock.yaml ]; then
            corepack enable
            pnpm install --frozen-lockfile
          elif [ -f yarn.lock ]; then
            corepack enable
            yarn install --frozen-lockfile || yarn install
          elif [ -f package.json ]; then
            npm install
          else
            echo "No package.json found; treating repository as static files."
          fi

      - name: Build
        run: |
          if [ -f package.json ]; then
            if node -e "process.exit((require('./package.json').scripts || {}).build ? 0 : 1)"; then
              ${buildCommand}
            else
              echo "No build script found; deploying static files."
            fi
          else
            echo "Skipping build."
          fi

      - name: Upload and finalize ShelbyHost deployment
        env:
          SHELBYHOST_DEPLOY_TOKEN: \${{ secrets.${GITHUB_DEPLOY_SECRET_NAME} }}
          SHELBYHOST_COMMIT_SHA: \${{ github.sha }}
          SHELBYHOST_COMMIT_MESSAGE: \${{ github.event.head_commit.message }}
        run: |
          node <<'NODE'
          const crypto = require("node:crypto");
          const fs = require("node:fs");
          const path = require("node:path");

          const apiUrl = process.env.SHELBYHOST_API_URL.replace(/\\/$/, "");
          const slug = process.env.SHELBYHOST_PROJECT_SLUG;
          const preferredOutputDir = process.env.SHELBYHOST_BUILD_OUTPUT || "dist";
          const token = process.env.SHELBYHOST_DEPLOY_TOKEN;

          if (!token) throw new Error("Missing GitHub secret ${GITHUB_DEPLOY_SECRET_NAME}");

          const mime = {
            html: "text/html",
            css: "text/css",
            js: "application/javascript",
            mjs: "application/javascript",
            json: "application/json",
            svg: "image/svg+xml",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
            ico: "image/x-icon",
            woff: "font/woff",
            woff2: "font/woff2",
            ttf: "font/ttf",
            txt: "text/plain",
            xml: "application/xml"
          };

          const ignoredDirs = new Set([".git", ".github", "node_modules", ".next", ".vercel"]);
          const candidates = Array.from(new Set([preferredOutputDir, "dist", "build", "out", "public", "."]));
          const outputDir = candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));

          if (!outputDir) {
            throw new Error(\`No index.html found. Checked: \${candidates.join(", ")}\`);
          }

          function walk(dir) {
            return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
              const absolute = path.join(dir, entry.name);
              if (entry.isDirectory() && ignoredDirs.has(entry.name)) return [];
              return entry.isDirectory() ? walk(absolute) : [absolute];
            });
          }

          const files = walk(outputDir).map((absolutePath) => {
            const relative = path.relative(outputDir, absolutePath).split(path.sep).join("/");
            const ext = relative.split(".").pop().toLowerCase();
            const stat = fs.statSync(absolutePath);
            return {
              name: path.basename(relative),
              size: stat.size,
              type: mime[ext] || "application/octet-stream",
              path: \`/\${relative}\`,
              absolutePath
            };
          }).sort((a, b) => a.path.localeCompare(b.path));

          if (!files.some((file) => file.path === "/index.html")) {
            throw new Error(\`No index.html found in \${outputDir}\`);
          }

          const combined = files.map((file) => {
            const fileHash = crypto.createHash("sha256").update(fs.readFileSync(file.absolutePath)).digest("hex");
            return \`\${fileHash}:\${file.path}\\n\`;
          }).join("");
          const hash = crypto.createHash("sha256").update(combined).digest("hex");
          const publicFiles = files.map(({ absolutePath, ...file }) => file);

          async function api(pathname, body) {
            const response = await fetch(\`\${apiUrl}\${pathname}\`, {
              method: "POST",
              headers: {
                authorization: \`Bearer \${token}\`,
                "content-type": "application/json"
              },
              body: JSON.stringify(body)
            });
            if (!response.ok) {
              throw new Error(\`\${pathname} failed: \${response.status} \${await response.text()}\`);
            }
            return response.json();
          }

          (async () => {
            const uploadPlan = await api("/api/github/upload-urls", {
              slug,
              hash,
            buildOutput: outputDir,
            files: publicFiles
          });

            const fileByPath = new Map(files.map((file) => [file.path, file]));
            for (const upload of uploadPlan.files) {
              const file = fileByPath.get(upload.path);
              if (!file) throw new Error(\`Upload plan referenced unknown path: \${upload.path}\`);
              const response = await fetch(upload.signedUrl, {
                method: "PUT",
                headers: {
                  "cache-control": "3600",
                  "content-type": file.type,
                  "x-upsert": "true"
                },
                body: fs.readFileSync(file.absolutePath)
              });
              if (!response.ok) {
                throw new Error(\`Upload failed for \${file.path}: \${response.status} \${await response.text()}\`);
              }
            }

            const result = await api("/api/github/finalize", {
              slug,
              hash,
              commitSha: process.env.SHELBYHOST_COMMIT_SHA,
              files: publicFiles,
              buildOutput: outputDir,
              message: process.env.SHELBYHOST_COMMIT_MESSAGE || "GitHub deployment"
            });

            console.log(\`ShelbyHost deployment live: \${result.publicUrl || result.versionUrl}\`);
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
          NODE
`;
}
