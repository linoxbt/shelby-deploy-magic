import type { BuildConfig } from "../../api/_lib/build-contract";
export function detect(
  info: { pkg: any; names: string[]; tsconfig: boolean },
  config: BuildConfig,
) {
  const { pkg, names } = info;
  if (!pkg) throw new Error("Missing package.json. Submit application source with a build script.");
  if (!pkg.scripts?.build && !config.buildCommand)
    throw new Error("Missing package.json scripts.build; configure an explicit build command.");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const framework = deps.next
    ? "next-static"
    : deps.astro
      ? "astro"
      : deps["@sveltejs/kit"]
        ? "sveltekit-static"
        : deps.nuxt
          ? "nuxt-static"
          : deps.vite
            ? "vite"
            : deps["react-scripts"]
              ? "create-react-app"
              : "custom";
  const locks = [
    ["package-lock.json", "npm"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
  ].filter(([file]) => names.includes(file));
  if (new Set(locks.map((x) => x[1])).size > 1)
    throw new Error("Conflicting package-manager lockfiles. Keep one package manager lockfile.");
  const declared = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : null;
  const pm = locks[0]?.[1] || declared || "npm";
  if (!["npm", "pnpm", "yarn", "bun"].includes(pm) || (declared && declared !== pm))
    throw new Error("Package manager does not match the lockfile");
  if (
    declared &&
    pkg.packageManager &&
    !new RegExp(`^${pm}@\\d+\\.\\d+\\.\\d+(?:[-+][A-Za-z0-9.-]+)?$`).test(pkg.packageManager)
  )
    throw new Error("packageManager must contain a fixed semantic version");
  const install =
    pm === "npm"
      ? locks.length
        ? ["npm", "ci", "--no-audit", "--no-fund"]
        : ["npm", "install", "--no-audit", "--no-fund"]
      : pm === "pnpm"
        ? ["pnpm", "install", ...(locks.length ? ["--frozen-lockfile"] : [])]
        : pm === "yarn"
          ? ["yarn", "install", ...(locks.length ? ["--frozen-lockfile"] : [])]
          : ["bun", "install", ...(locks.length ? ["--frozen-lockfile"] : [])];
  const candidates =
    framework === "next-static"
      ? ["out"]
      : framework === "nuxt-static"
        ? [".output/public"]
        : framework === "create-react-app"
          ? ["build"]
          : ["dist", "build", "out", "public"];
  return {
    framework,
    packageManager: pm,
    declaredPackageManager: pkg.packageManager || null,
    install,
    buildCommand: config.buildCommand || `${pm} run build`,
    candidates,
    typecheck: info.tsconfig,
    hasTypeScript: !!deps.typescript,
  };
}
