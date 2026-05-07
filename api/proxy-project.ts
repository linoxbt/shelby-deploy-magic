import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  const { slug, path } = req.query;

  if (!slug || !path) {
    return res.status(400).send("Missing slug or path");
  }

  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!sbUrl || !sbKey) {
    return res.status(500).send("Server Configuration Error: Missing Supabase keys");
  }

  const supabase = createClient(sbUrl, sbKey);

  // 1. Get the content hash for this slug
  const { data: project, error } = await supabase
    .from("shelby_projects")
    .select("content_hash, status")
    .eq("slug", slug)
    .single();

  if (error || !project) {
    return res.status(404).send("Project Not Found");
  }

  if (project.status !== "live") {
    return res.status(503).send("Project is not live yet");
  }

  // 2. Fetch the file from Supabase Storage
  const storageUrl = `${sbUrl}/storage/v1/object/public/shelby_nodes/${project.content_hash}${path}`;

  try {
    const response = await fetch(storageUrl);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");

    if (!response.ok) {
      // SPA Fallback: if file not found, try index.html
      const spaRes = await fetch(
        `${sbUrl}/storage/v1/object/public/shelby_nodes/${project.content_hash}/index.html`,
      );
      if (spaRes.ok) {
        const data = await spaRes.arrayBuffer();
        res.setHeader("Content-Type", "text/html");
        return res.send(Buffer.from(data));
      }
      return res.status(404).send("File Not Found");
    }

    const data = await response.arrayBuffer();
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    return res.send(Buffer.from(data));
  } catch (err) {
    return res.status(500).send("Gateway Error");
  }
}
