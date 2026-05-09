#!/usr/bin/env node
/**
 * Fails CI if any required npm scripts are missing from package.json.
 * Run via: node scripts/check-required-scripts.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const REQUIRED_SCRIPTS = ["dev", "build", "build:dev", "preview", "lint"];

const missing = REQUIRED_SCRIPTS.filter((name) => !pkg.scripts || !pkg.scripts[name]);

if (missing.length > 0) {
  console.error(
    `\n\u274C Missing required npm scripts in package.json:\n  - ${missing.join("\n  - ")}\n`,
  );
  console.error(
    "Add them under \"scripts\" before deploying. See README.md \u2192 \"Build commands\".\n",
  );
  process.exit(1);
}

console.log(`\u2705 All required npm scripts present: ${REQUIRED_SCRIPTS.join(", ")}`);