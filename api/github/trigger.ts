import { requireAuth } from "../_lib/auth";
import { requireProjectDeployAuth } from "../_lib/deploy-token";
import { enqueueBuild, frozenSource } from "../_lib/build-queue";
import { getOwnedProject, getSupabaseAdmin } from "../_lib/supabase";
import { readJson, errorResponse, methodNotAllowed } from "../_lib/http";
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const body = await readJson<any>(req);
    let project: any;
    try {
      const auth = await requireAuth(req);
      project = await getOwnedProject(auth.userId, String(body.slug || ""));
    } catch {
      project = (await requireProjectDeployAuth(req, String(body.slug || ""))).project;
    }
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("shelby_github_connections")
      .select("*")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No GitHub repository connected");
    // A deploy token can trigger the configured production branch, not substitute
    // another repository or branch that might expose production build secrets.
    if (body.branch && body.branch !== data.branch)
      throw new Error("Only the configured production branch may deploy");
    const source = await frozenSource(project.owner_id, {
      kind: "github",
      repository: `${data.account}/${data.repository}`,
      branch: data.branch,
    });
    const id = await enqueueBuild(project, project.owner_id, source, project.build_config || {});
    return res.status(202).json({ ok: true, deploymentId: id, status: "queued" });
  } catch (error) {
    return errorResponse(res, error instanceof Error ? error : new Error((error as any)?.message));
  }
}
