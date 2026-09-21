import crypto from "node:crypto";
import { enqueueBuild, frozenSource } from "../_lib/build-queue";
import { getSupabaseAdmin } from "../_lib/supabase";
import { errorResponse, methodNotAllowed } from "../_lib/http";
export const config = { api: { bodyParser: false } };
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    if (!process.env.GITHUB_WEBHOOK_SECRET)
      return res.status(503).json({ error: "GitHub webhook signing secret is not configured" });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) return res.status(413).json({ error: "Webhook too large" });
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks),
      signature = String(req.headers["x-hub-signature-256"] || "");
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET).update(raw).digest("hex");
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return res.status(401).json({ error: "Invalid webhook signature" });
    const delivery = String(req.headers["x-github-delivery"] || "");
    if (!delivery || delivery.length > 100) throw new Error("Webhook delivery ID is required");
    if (req.headers["x-github-event"] !== "push") return res.status(200).json({ ignored: true });
    const payload = JSON.parse(raw.toString());
    if (payload.deleted) return res.status(200).json({ ignored: true });
    const repository = String(payload.repository?.full_name || ""),
      branch = String(payload.ref || "").replace(/^refs\/heads\//, "");
    const [account, repo] = repository.split("/"),
      db = getSupabaseAdmin();
    const { data, error } = await db
      .from("shelby_github_connections")
      .select("project_id")
      .eq("account", account)
      .eq("repository", repo)
      .eq("branch", branch)
      .eq("webhook_status", "active");
    if (error) throw error;
    const queued = [];
    for (const connection of data || []) {
      const { data: project, error: projectError } = await db
        .from("shelby_projects")
        .select("*")
        .eq("id", connection.project_id)
        .single();
      if (projectError) throw projectError;
      const source = await frozenSource(project.owner_id, {
        kind: "github",
        repository,
        branch,
        commit: payload.after,
      });
      queued.push(
        await enqueueBuild(
          project,
          project.owner_id,
          source,
          project.build_config || {},
          `${delivery}:${project.id}`,
        ),
      );
    }
    return res.status(202).json({ deploymentIds: queued });
  } catch (error) {
    return errorResponse(res, error instanceof Error ? error : new Error((error as any)?.message));
  }
}
