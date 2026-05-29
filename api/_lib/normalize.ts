export type FileEntryInput = {
  name: string;
  size: number;
  type: string;
  path: string;
};

function cleanSegment(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
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
  const normalizedPath = `/${cleanSegment(path)}`;
  const output = cleanSegment(buildOutput || "dist");
  const outputPrefix = `/${output}/`;

  if (normalizedPath === `/${output}`) return "/";
  if (normalizedPath.startsWith(outputPrefix)) {
    return `/${normalizedPath.slice(outputPrefix.length)}`;
  }

  return normalizedPath;
}

export function normalizeFiles(files: FileEntryInput[], buildOutput = "dist") {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    path: normalizeDeployPath(file.path || file.name, buildOutput),
  }));
}

export function assertDeployable(files: FileEntryInput[], buildOutput = "dist") {
  const normalized = normalizeFiles(files, buildOutput);
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
