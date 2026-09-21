export function tenantRoute(
  hostname: string,
  baseDomain = process.env.SHELBY_BASE_DOMAIN || "shelbyhost.xyz",
) {
  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  if (
    host === baseDomain ||
    host === `www.${baseDomain}` ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".netlify.app") ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    (process.env.SHELBY_APP_HOSTS || "").split(",").includes(host)
  )
    return null;
  if (host.endsWith(`.${baseDomain}`)) {
    const slug = host.slice(0, -baseDomain.length - 1);
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return { invalid: true };
    return { slug };
  }
  if (!/^[a-z0-9.-]+$/.test(host)) return { invalid: true };
  return { domain: host };
}
export function releaseUrl(id: string) {
  return `https://v-${id.replace(/-/g, "")}.${process.env.SHELBY_BASE_DOMAIN || "shelbyhost.xyz"}`;
}
export function requestAssetPath(input: string) {
  const decoded = decodeURIComponent(input.split("?")[0]);
  // Reject control bytes, including NUL, in URL-derived paths.
  if (
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1f\\?#%]/.test(decoded) ||
    decoded.split("/").some((p) => p === ".." || p === "." || p.startsWith("."))
  )
    throw new Error("Invalid asset path");
  return decoded.startsWith("/") ? decoded : `/${decoded}`;
}
