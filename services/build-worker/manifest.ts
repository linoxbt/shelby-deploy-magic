import { createHash } from "node:crypto";
export const digest = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest("hex");
const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
  wasm: "application/wasm",
  map: "application/json",
};
export type Artifact = { path: string; content: string };
export function artifactManifest(files: Artifact[]) {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const manifest = sorted.map((f) => ({
    path: f.path,
    sha256: digest(Buffer.from(f.content, "base64")),
    size: Buffer.byteLength(f.content, "base64"),
    type: types[f.path.split(".").pop()!.toLowerCase()] || "application/octet-stream",
  }));
  return { hash: digest(manifest.map((f) => `${f.sha256}:${f.path}\n`).join("")), manifest };
}
