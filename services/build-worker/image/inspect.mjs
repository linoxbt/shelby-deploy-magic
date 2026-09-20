// Trusted inspector baked into the read-only image. Never loads project modules.
import fs from "node:fs";
import path from "node:path";
const input = JSON.parse(fs.readFileSync(0, "utf8"));
const base = "/workspace/source";
function safe(relative) {
  if (fs.lstatSync(base).isSymbolicLink()) throw new Error("Symlink source root is not allowed");
  const result = path.resolve(base, relative);
  if (result !== base && !result.startsWith(base + "/")) throw new Error("Path escapes source");
  let current = base;
  for (const part of path.relative(base, result).split("/").filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Symlink not allowed: " + relative);
  }
  return result;
}
if (input.mode === "source") {
  fs.mkdirSync(base, { recursive: true });
  for (const file of input.files) {
    const dest = path.resolve(base, file.path);
    if (!dest.startsWith(base + "/")) throw new Error("Invalid source path");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(file.content, "base64"), { flag: "wx" });
  }
} else if (input.mode === "detect") {
  const root = safe(input.rootDirectory);
  const names = fs.readdirSync(root);
  const packagePath = path.join(root, "package.json");
  const pkg = names.includes("package.json")
    ? JSON.parse(fs.readFileSync(safe(path.relative(base, packagePath)), "utf8"))
    : null;
  const tsconfig = names.includes("tsconfig.json");
  const commit = fs.existsSync("/workspace/commit")
    ? fs.readFileSync("/workspace/commit", "utf8").trim()
    : null;
  console.log(JSON.stringify({ pkg, names, tsconfig, commit }));
} else if (input.mode === "artifacts") {
  const root = safe(input.rootDirectory);
  let out = input.outputDirectory;
  if (!out)
    out = input.candidates.find((p) => {
      try {
        return fs.lstatSync(path.join(root, p, "index.html")).isFile();
      } catch {
        return false;
      }
    });
  if (!out)
    throw new Error(
      "No static index.html found. Configure the output directory. SSR/server runtimes are not supported.",
    );
  const dir = safe(path.relative(base, path.resolve(root, out)));
  if (!dir.startsWith(root + "/") && dir !== root)
    throw new Error("Output escapes application root");
  const files = [];
  let bytes = 0;
  function walk(folder) {
    for (const name of fs.readdirSync(folder).sort()) {
      if (
        name.startsWith(".") ||
        [
          "node_modules",
          "package.json",
          "package-lock.json",
          "pnpm-lock.yaml",
          "yarn.lock",
          "bun.lock",
          "bun.lockb",
        ].includes(name)
      )
        throw new Error("Source or private file in output: " + name);
      const full = path.join(folder, name),
        stat = fs.lstatSync(full);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
        throw new Error("Non-regular artifact: " + name);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (stat.nlink > 1) throw new Error("Hard-linked artifact: " + name);
      bytes += stat.size;
      if (stat.size > 50 * 1024 * 1024 || bytes > 100 * 1024 * 1024 || files.length >= 2000)
        throw new Error("Artifact limits exceeded (50 MiB/file, 100 MiB total, 2000 files)");
      const rel = path.relative(dir, full).split(path.sep).join("/");
      if (/[\x00-\x1f\\?#%]/.test(rel)) throw new Error("Invalid artifact path: " + rel);
      files.push({ path: "/" + rel, content: fs.readFileSync(full).toString("base64") });
    }
  }
  walk(dir);
  const index = files.find((f) => f.path === "/index.html");
  if (!index) throw new Error("Output requires index.html");
  const html = Buffer.from(index.content, "base64").toString("utf8");
  if (!/<(?:!doctype\s+html|html|head|body)/i.test(html))
    throw new Error("index.html is not an HTML document");
  const paths = new Set(files.map((f) => f.path));
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const ref = match[1];
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    const local = path.posix.resolve("/", ref.split(/[?#]/)[0]);
    if (/\.(?:js|mjs|css|png|jpg|jpeg|svg|ico|woff2?)$/i.test(local) && !paths.has(local))
      throw new Error("Missing referenced asset: " + local);
  }
  console.log(JSON.stringify({ files, outputDirectory: out, bytes }));
}
