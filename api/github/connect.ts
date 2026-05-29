import { generateDeployToken, hashDeployToken, lastFour } from "../_lib/deploy-token";
import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { getOwnedProject, getSupabaseAdmin } from "../_lib/supabase";
import {
  GITHUB_DEPLOY_SECRET_NAME,
  GITHUB_WORKFLOW_FILE,
  githubWorkflowYaml,
} from "../_lib/workflow";

type ConnectPayload = {
  slug: string;
  account: string;
  repository: string;
  branch?: string;
  workflowFile?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const auth = await requireAuth(req);
    const body = await readJson<ConnectPayload>(req);
    const project = await getOwnedProject(auth.userId, body.slug);
    if (!body.account) throw new Error("Repository owner is required");
    if (!body.repository) throw new Error("Repository is required");

    const deployToken = generateDeployToken();
    const workflowFile = body.workflowFile || GITHUB_WORKFLOW_FILE;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("shelby_github_connections")
      .upsert(
        {
          project_id: project.id,
          account: body.account,
          repository: body.repository,
          branch: body.branch || "main",
          workflow_file: workflowFile,
          webhook_status: "active",
          automation_status: "manual",
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
      deployToken,
      secretName: GITHUB_DEPLOY_SECRET_NAME,
      workflowFile,
      workflowYaml: githubWorkflowYaml({
        slug: project.slug,
        branch: body.branch || "main",
        buildOutput: project.build_output,
      }),
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
