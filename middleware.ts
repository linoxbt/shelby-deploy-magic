import { next, rewrite } from "@vercel/functions";

const BASE_DOMAIN = process.env.SHELBY_BASE_DOMAIN || "shelbyhost.xyz";

const APP_HOSTS = new Set(
  [
    BASE_DOMAIN,
    `www.${BASE_DOMAIN}`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...(process.env.SHELBY_APP_HOSTS || "").split(","),
  ]
    .map((host) => host?.trim().toLowerCase())
    .filter(Boolean) as string[],
);

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

function getProjectRoute(hostname: string) {
  const host = hostname.toLowerCase().split(":")[0];
  if (APP_HOSTS.has(host) || host.endsWith(".vercel.app")) return null;

  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const slug = host.slice(0, -`.${BASE_DOMAIN}`.length);
    if (!slug || slug === "www") return null;
    return { slug, domain: "" };
  }

  return { slug: "", domain: host };
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  if (isApi(url.pathname)) return next();

  const projectRoute = getProjectRoute(url.hostname);
  if (!projectRoute) return next();

  const destination = new URL("/api/proxy-project", request.url);
  destination.searchParams.set("path", url.pathname === "/" ? "/index.html" : url.pathname);
  if (projectRoute.slug) destination.searchParams.set("slug", projectRoute.slug);
  if (projectRoute.domain) destination.searchParams.set("domain", projectRoute.domain);

  return rewrite(destination);
}

export const config = {
  matcher: "/((?!api/).*)",
};
