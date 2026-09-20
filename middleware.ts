import { next, rewrite } from "@vercel/functions";
import { tenantRoute } from "./api/_lib/routing";
export default function middleware(request: Request) {
  const url = new URL(request.url),
    route = tenantRoute(url.hostname);
  if (!route) return next();
  if ("invalid" in route) return new Response("Invalid hostname", { status: 404 });
  const destination = new URL("/api/proxy-project", request.url);
  destination.searchParams.set("path", url.pathname);
  return rewrite(destination);
}
// Tenant /api paths are tenant content, never control-plane endpoints.
export const config = { matcher: "/:path*" };
