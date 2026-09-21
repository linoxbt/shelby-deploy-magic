import http from "node:http";
import gateway from "../../api/proxy-project";
import { tenantRoute } from "../../api/_lib/routing";
import { getSupabaseAdmin } from "../../api/_lib/supabase";
// Bind to loopback behind Caddy. Never trust X-Forwarded-Host from a client.
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (
    url.pathname === "/_shelby/tls-ask" &&
    req.headers.host === `127.0.0.1:${process.env.GATEWAY_PORT || 8090}`
  ) {
    try {
      const domain = url.searchParams.get("domain") || "",
        route = tenantRoute(domain),
        db = getSupabaseAdmin();
      if (!route || "invalid" in route) {
        res.writeHead(403).end();
        return;
      }
      let allowed = false;
      if (route.slug?.match(/^v-[a-f0-9]{32}$/)) {
        const h = route.slug.slice(2),
          id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        const { data, error } = await db
          .from("shelby_deployments")
          .select("id")
          .eq("id", id)
          .eq("status", "ready")
          .maybeSingle();
        allowed = !error && !!data;
      } else if (route.slug) {
        const { data, error } = await db
          .from("shelby_projects")
          .select("content_hash")
          .eq("slug", route.slug)
          .maybeSingle();
        allowed = !error && !!data?.content_hash;
      } else {
        const { data, error } = await db
          .from("shelby_domain_mappings")
          .select("id")
          .eq("domain", route.domain)
          .eq("status", "active")
          .maybeSingle();
        allowed = !error && !!data;
      }
      res.writeHead(allowed ? 200 : 403).end();
    } catch {
      res.writeHead(503).end();
    }
    return;
  }
  const response = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return response;
    },
    send(body: string | Buffer) {
      res.end(body);
      return response;
    },
  });
  await gateway(Object.assign(req, { query: { path: url.pathname } }), response);
});
server.headersTimeout = 10000;
server.requestTimeout = 45000;
server.maxRequestsPerSocket = 100;
server.listen(Number(process.env.GATEWAY_PORT || 8090), "127.0.0.1", () =>
  console.log("Shelby gateway listening on loopback"),
);
