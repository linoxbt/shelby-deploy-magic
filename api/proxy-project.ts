import { createClient } from "@supabase/supabase-js";
import { shelbyManifestUrl, type ShelbyManifestEntry } from "./_lib/shelby";

function shouldFallbackToIndex(req: any, path: string) {
  const accept = String(req.headers.accept || "");
  const filename = path.split("/").pop() || "";
  return accept.includes("text/html") || !filename.includes(".");
}

async function proxyAsset(req: any, res: any, url: string, headers?: HeadersInit) {
  const response = await fetch(url, { headers });
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");

  if (!response.ok) return false;

  const data = await response.arrayBuffer();
  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  res.send(Buffer.from(data));
  return true;
}

export default async function handler(req: any, res: any) {
  const { slug, domain, path } = req.query;

  if ((!slug && !domain) || !path) {
    return res.status(400).send("Missing slug/domain or path");
  }

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!sbUrl || !sbKey) {
    return res.status(500).send("Server Configuration Error: Missing Supabase keys");
  }

  const supabase = createClient(sbUrl, sbKey);

  let project: {
    content_hash: string;
    status: string;
    storage_backend?: string | null;
    shelby_manifest?: ShelbyManifestEntry[] | null;
  } | null = null;
  let projectError: unknown = null;

  if (slug) {
    const { data, error } = await supabase
      .from("shelby_projects")
      .select("content_hash, status, storage_backend, shelby_manifest")
      .eq("slug", String(slug).toLowerCase())
      .maybeSingle();
    project = data;
    projectError = error;

    if (!project && !projectError) {
      const { data: preview, error: previewError } = await supabase
        .from("shelby_preview_deployments")
        .select("content_hash, status, storage_backend, shelby_manifest")
        .eq("preview_slug", String(slug).toLowerCase())
        .maybeSingle();

      projectError = previewError;
      if (preview) {
        project = {
          content_hash: preview.content_hash,
          status: preview.status === "ready" ? "live" : "processing",
          storage_backend: preview.storage_backend,
          shelby_manifest: preview.shelby_manifest,
        };
      }
    }
  } else {
    const { data, error } = await supabase
      .from("shelby_domain_mappings")
      .select(
        "status, content_hash, shelby_projects!inner(status, storage_backend, shelby_manifest)",
      )
      .eq("domain", String(domain).toLowerCase())
      .single();

    projectError = error;
    const projectRow = Array.isArray((data as any)?.shelby_projects)
      ? (data as any).shelby_projects[0]
      : (data as any)?.shelby_projects;

    if (data) {
      project = {
        content_hash: data.content_hash,
        status: data.status === "active" && projectRow?.status === "live" ? "live" : "processing",
        storage_backend: projectRow?.storage_backend,
        shelby_manifest: projectRow?.shelby_manifest,
      };
    }
  }

  if (projectError || !project) {
    return res.status(404).send("Project Not Found");
  }

  if (project.status !== "live") {
    return res.status(503).send("Project is not live yet");
  }

  const rawPath = Array.isArray(path) ? path.join("/") : String(path);
  const safePath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  if (safePath.includes("..")) {
    return res.status(400).send("Invalid path");
  }

  if (project.storage_backend === "shelby") {
    const shelbyUrl = shelbyManifestUrl(project.shelby_manifest, safePath);
    const headers = process.env.SHELBY_API_KEY
      ? { Authorization: `Bearer ${process.env.SHELBY_API_KEY}` }
      : undefined;
    if (shelbyUrl && (await proxyAsset(req, res, shelbyUrl, headers))) return;
  }

  const storageUrl = `${sbUrl}/storage/v1/object/public/shelby_nodes/${project.content_hash}${safePath}`;

  try {
    if (!(await proxyAsset(req, res, storageUrl))) {
      if (!shouldFallbackToIndex(req, safePath)) {
        return res.status(404).send("File Not Found");
      }

      if (project.storage_backend === "shelby") {
        const shelbyIndexUrl = shelbyManifestUrl(project.shelby_manifest, "/index.html");
        const headers = process.env.SHELBY_API_KEY
          ? { Authorization: `Bearer ${process.env.SHELBY_API_KEY}` }
          : undefined;
        if (shelbyIndexUrl && (await proxyAsset(req, res, shelbyIndexUrl, headers))) return;
      }

      const spaUrl = `${sbUrl}/storage/v1/object/public/shelby_nodes/${project.content_hash}/index.html`;
      if (await proxyAsset(req, res, spaUrl)) return;
      return res.status(404).send("File Not Found");
    }
  } catch (err) {
    return res.status(500).send("Gateway Error");
  }
}
