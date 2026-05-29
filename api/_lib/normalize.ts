export type FileEntryInput = {
  name: string;
  size: number;
  type: string;
  path: string;
};

const DEFAULT_MAX_FILES = 2000;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;

function cleanSegment(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function numericLimit(name: string, fallback: number) {
  const value = Number(process.env[name] || "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeContentHash(value: string) {
  const hash = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error("Deployment hash must be a 64-character SHA-256 hex digest");
  }
  return hash;
}

export function normalizeSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug) throw new Error("Project slug is required");
  if (slug.length > 63) throw new Error("Project slug must be 63 characters or fewer");
  if (["www", "api", "app", "admin", "dashboard", "assets", "static"].includes(slug)) {
    throw new Error(`"${slug}" is reserved and cannot be used as a project slug`);
  }
  if (slug.endsWith("-") || slug.startsWith("-")) {
    throw new Error("Project slug cannot start or end with a hyphen");
  }
  return slug;
}

export function normalizeDeployPath(path: string, buildOutput = "dist") {
  const normalizedPath = `/${cleanSegment(String(path || "").replace(/\\/g, "/"))}`;
  const output = cleanSegment(buildOutput || "dist");
  const outputPrefix = `/${output}/`;

  if (
    normalizedPath.length > 1024 ||
    normalizedPath.split("/").some((segment) => segment === "..") ||
    /[\0\r\n]/.test(normalizedPath)
  ) {
    throw new Error(`Invalid deploy path: ${path}`);
  }

  if (normalizedPath === `/${output}`) return "/";
  if (normalizedPath.startsWith(outputPrefix)) {
    return `/${normalizedPath.slice(outputPrefix.length)}`;
  }

  return normalizedPath;
}

export function normalizeFiles(files: FileEntryInput[], buildOutput = "dist") {
  return files.map((file) => ({
    name: String(file.name || "").slice(0, 255),
    size: Number(file.size || 0),
    type: file.type || "application/octet-stream",
    path: normalizeDeployPath(file.path || file.name, buildOutput),
  }));
}

export function assertDeployable(files: FileEntryInput[], buildOutput = "dist") {
  const maxFiles = numericLimit("SHELBY_MAX_DEPLOY_FILES", DEFAULT_MAX_FILES);
  const maxBytes = numericLimit("SHELBY_MAX_DEPLOY_BYTES", DEFAULT_MAX_BYTES);
  const maxFileBytes = numericLimit("SHELBY_MAX_DEPLOY_FILE_BYTES", DEFAULT_MAX_FILE_BYTES);

  if (files.length === 0) throw new Error("No files were provided for deployment");
  if (files.length > maxFiles) {
    throw new Error(`Deployment has too many files. Maximum allowed is ${maxFiles}.`);
  }

  const normalized = normalizeFiles(files, buildOutput);
  const totalBytes = normalized.reduce((sum, file) => {
    if (!Number.isFinite(file.size) || file.size < 0) {
      throw new Error(`File ${file.path} has an invalid size`);
    }
    if (file.size > maxFileBytes) {
      throw new Error(`File ${file.path} exceeds the ${maxFileBytes} byte limit`);
    }
    return sum + file.size;
  }, 0);

  if (totalBytes > maxBytes) {
    throw new Error(`Deployment exceeds the ${maxBytes} byte limit`);
  }

  if (!normalized.some((file) => file.path === "/index.html")) {
    throw new Error(`No index.html found in ${buildOutput}. Upload a production build output.`);
  }
  return normalized;
}

export function sanitizeDomain(value: string) {
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new Error("Enter a valid domain name");
  }
  return domain;
}
