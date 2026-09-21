import { boundedBody } from "./_lib/bounded-body";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./_lib/supabase";
import { shelbyBlobUrl } from "./_lib/shelby";
import { tenantRoute, requestAssetPath } from "./_lib/routing";

export default async function handler(req: any, res: any) {
  try {
    if (!["GET", "HEAD"].includes(req.method))
      return res.status(405).send("Static deployments support GET and HEAD");
    const route = tenantRoute(String(req.headers.host || ""));
    if (!route || "invalid" in route) return res.status(404).send("Unknown deployment host");
    const db = getSupabaseAdmin();
    let release: any, project: any;
    let immutable = false;
    if (route.slug?.match(/^v-[a-f0-9]{32}$/)) {
      const hex = route.slug.slice(2),
        id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      const { data, error } = await db
        .from("shelby_deployments")
        .select("*")
        .eq("id", id)
        .eq("status", "ready")
        .single();
      if (error || !data) return res.status(404).send("Release not found");
      release = data;
      immutable = true;
    } else {
      let projectId: string | undefined;
      if (route.domain) {
        const { data } = await db
          .from("shelby_domain_mappings")
          .select("project_id")
          .eq("domain", route.domain)
          .eq("status", "active")
          .maybeSingle();
        if (!data) return res.status(404).send("Domain not found");
        projectId = data.project_id;
      }
      const { data, error } = await db
        .from("shelby_projects")
        .select("*")
        .eq(projectId ? "id" : "slug", projectId || route.slug)
        .maybeSingle();
      if (error || !data) return res.status(404).send("Project not found");
      project = data;
      if (project.active_deployment_id) {
        const result = await db
          .from("shelby_deployments")
          .select("*")
          .eq("id", project.active_deployment_id)
          .eq("project_id", project.id)
          .eq("status", "ready")
          .single();
        if (result.error) return res.status(503).send("Active release is unavailable");
        release = result.data;
      } else if (!project.content_hash)
        return res.status(503).send("No successful deployment has been published yet");
    }
    const raw = String(req.query?.path || new URL(req.url, "http://localhost").pathname),
      assetPath = requestAssetPath(raw);
    const candidates = [assetPath.endsWith("/") ? `${assetPath}index.html` : assetPath];
    if (!assetPath.split("/").pop()?.includes("."))
      candidates.push(`${assetPath.replace(/\/$/, "")}/index.html`, "/index.html");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cache-Control", immutable ? "public,max-age=31536000,immutable" : "no-store");
    if (release) {
      const manifest = release.shelby_manifest || [];
      const entry = candidates.map((p) => manifest.find((e: any) => e.path === p)).find(Boolean);
      if (!entry) return res.status(404).send("Asset not found");
      if (
        !/^0x[a-f0-9]+$/i.test(release.shelby_owner_address) ||
        !String(entry.blobName).startsWith(
          `releases/${release.project_id}/${release.id}/${release.content_hash}/`,
        )
      )
        throw new Error("Invalid deployment manifest");
      const response = await fetch(shelbyBlobUrl(release.shelby_owner_address, entry.blobName), {
        headers: { Authorization: `Bearer ${process.env.SHELBY_API_KEY || ""}` },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) return res.status(502).send(`Shelby storage returned ${response.status}`);
      const body = await boundedBody(response, entry.size);
      if (
        body.length !== entry.size ||
        createHash("sha256").update(body).digest("hex") !== entry.sha256
      )
        return res.status(502).send("Deployment asset failed integrity verification");
      res.setHeader("Content-Type", entry.type);
      res.setHeader("ETag", `"${entry.sha256}"`);
      res.setHeader("X-Shelby-Deployment", release.id);
      return res.status(200).send(req.method === "HEAD" ? "" : body);
    }
    // Compatibility is read-only. New releases always go through Shelby, and
    // cannot acquire this fallback by failing their upload stage.
    for (const candidate of candidates) {
      const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/shelby_nodes/${project.content_hash}${candidate}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        res.setHeader(
          "Content-Type",
          response.headers.get("content-type") || "application/octet-stream",
        );
        return res
          .status(200)
          .send(req.method === "HEAD" ? "" : await boundedBody(response, 50 * 1024 * 1024));
      }
    }
    return res.status(404).send("Asset not found");
  } catch (error) {
    return res
      .status(error instanceof URIError || String(error).includes("Invalid asset path") ? 400 : 502)
      .send(error instanceof Error ? error.message : "Deployment gateway failed");
  }
}
