import { generateDeployToken, hashDeployToken, lastFour } from "../../_lib/deploy-token";
import {
  createInstallationToken,
  githubAppConfigured,
  githubAppInstallUrl,
  upsertRepoSecret,
  upsertWorkflowFile,
} from "../../_lib/github";
import { requireAuth } from "../../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../../_lib/http";
import { getOwnedProject, getSupabaseAdmin } from "../../_lib/supabase";
import {
  GITHUB_DEPLOY_SECRET_NAME,
  GITHUB_WORKFLOW_FILE,
  githubWorkflowYaml,
} from "../../_lib/workflow";

type SetupPayload = {
  slug: string;
  installationId?: number | string;
  account: string;
  repository: string;
  branch?: string;
  workflowFile?: string;
  buildCommand?: string;
  buildOutput?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    return res.status(200).json({
      configured: githubAppConfigured(),
      installUrl: githubAppInstallUrl(),
    });
  }

  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);

  try {
    if (!githubAppConfigured()) {
      throw new Error("GitHub App automation is not configured");
    }

    const auth = await requireAuth(req);
    const body = await readJson<SetupPayload>(req);
    const project = await getOwnedProject(auth.userId, body.slug);
    const owner = body.account?.trim();
    const repository = body.repository?.trim();
    const branch = body.branch?.trim() || "main";
    const installationId = body.installationId || req.query.installation_id;
    const workflowFile = body.workflowFile || GITHUB_WORKFLOW_FILE;

    if (!installationId) throw new Error("GitHub App installation ID is required");
    if (!owner) throw new Error("Repository owner is required");
    if (!repository) throw new Error("Repository is required");

    const deployToken = generateDeployToken();
    const workflowYaml = githubWorkflowYaml({
      slug: project.slug,
      branch,
      buildCommand: body.buildCommand,
      buildOutput: body.buildOutput || project.build_output || "dist",
    });
    const installationToken = await createInstallationToken(installationId);

    await upsertRepoSecret({
      token: installationToken,
      owner,
      repo: repository,
      secretName: GITHUB_DEPLOY_SECRET_NAME,
      secretValue: deployToken,
    });

    await upsertWorkflowFile({
      token: installationToken,
      owner,
      repo: repository,
      branch,
      workflowFile,
      workflowYaml,
    });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("shelby_github_connections")
      .upsert(
        {
          project_id: project.id,
          account: owner,
          repository,
          branch,
          workflow_file: workflowFile,
          webhook_status: "active",
          github_installation_id: String(installationId),
          automation_status: "configured",
          deploy_token_hash: hashDeployToken(deployToken),
          deploy_token_last_four: lastFour(deployToken),
        },
        { onConflict: "project_id,repository,branch" },
      )
      .select("*")
      .single();

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      connection: data,
      automated: true,
      workflowFile,
      secretName: GITHUB_DEPLOY_SECRET_NAME,
      tokenLastFour: lastFour(deployToken),
      workflowYaml,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
