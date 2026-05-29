import {
  createInstallationToken,
  decryptToken,
  githubAppConfigured,
  triggerWorkflow,
} from "../_lib/github";
import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { getOwnedProject, getSupabaseAdmin } from "../_lib/supabase";

type TriggerPayload = {
  slug: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const auth = await requireAuth(req);
    const body = await readJson<TriggerPayload>(req);
    const project = await getOwnedProject(auth.userId, body.slug);
    const supabase = getSupabaseAdmin();

    const { data: connection, error: connectionError } = await supabase
      .from("shelby_github_connections")
      .select("*")
      .eq("project_id", project.id)
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) throw new Error("No GitHub repository connected");

    let token = "";
    if (connection.github_installation_id && githubAppConfigured()) {
      token = await createInstallationToken(connection.github_installation_id);
    } else {
      const { data: account, error: accountError } = await supabase
        .from("shelby_github_accounts")
        .select("access_token_encrypted")
        .eq("owner_id", auth.userId)
        .eq("login", connection.account)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!account) throw new Error("GitHub account token not found");
      token = decryptToken(account.access_token_encrypted);
    }

    await triggerWorkflow({
      token,
      owner: connection.account,
      repo: connection.repository,
      branch: connection.branch,
      workflowFile: connection.workflow_file,
    });

    const { error: deploymentError } = await supabase.from("shelby_deployments").insert({
      project_id: project.id,
      content_hash: project.content_hash || "",
      version_url: project.latest_version_url || "",
      status: "queued",
      trigger: "github-push",
      message: "Manual GitHub Actions dispatch",
      storage_backend: "pending",
    });

    if (deploymentError) throw deploymentError;

    return res.status(200).json({ ok: true });
  } catch (error) {
    return errorResponse(res, error);
  }
}
