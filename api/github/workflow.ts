import { generateDeployToken, hashDeployToken, lastFour } from "../_lib/deploy-token";
import {
  createInstallationToken,
  githubAppConfigured,
  upsertRepoSecret,
  upsertWorkflowFile,
} from "../_lib/github";
import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { getOwnedProject, getSupabaseAdmin } from "../_lib/supabase";
import {
  GITHUB_DEPLOY_SECRET_NAME,
  GITHUB_WORKFLOW_FILE,
  githubWorkflowYaml,
} from "../_lib/workflow";

type WorkflowPayload = {
  slug: string;
  rotateToken?: boolean;
};

async function getConnection(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("shelby_github_connections")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No GitHub repository connected");
  return data;
}

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const slug = req.method === "GET" ? String(req.query.slug || "") : "";
    const body = req.method === "POST" ? await readJson<WorkflowPayload>(req) : null;
    const project = await getOwnedProject(auth.userId, body?.slug || slug);
    const connection = await getConnection(project.id);

    if (req.method === "GET") {
      return res.status(200).json({
        workflowFile: connection.workflow_file || GITHUB_WORKFLOW_FILE,
        secretName: GITHUB_DEPLOY_SECRET_NAME,
        tokenLastFour: connection.deploy_token_last_four || null,
        automated: connection.automation_status === "configured",
        workflowYaml: githubWorkflowYaml({
          slug: project.slug,
          branch: connection.branch,
          buildOutput: project.build_output,
        }),
      });
    }

    if (req.method === "POST") {
      const deployToken = generateDeployToken();
      const workflowYaml = githubWorkflowYaml({
        slug: project.slug,
        branch: connection.branch,
        buildOutput: project.build_output,
      });

      if (connection.github_installation_id && githubAppConfigured()) {
        const installationToken = await createInstallationToken(connection.github_installation_id);
        await upsertRepoSecret({
          token: installationToken,
          owner: connection.account,
          repo: connection.repository,
          secretValue: deployToken,
        });
        await upsertWorkflowFile({
          token: installationToken,
          owner: connection.account,
          repo: connection.repository,
          branch: connection.branch,
          workflowFile: connection.workflow_file || GITHUB_WORKFLOW_FILE,
          workflowYaml,
        });
      }

      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("shelby_github_connections")
        .update({
          deploy_token_hash: hashDeployToken(deployToken),
          deploy_token_last_four: lastFour(deployToken),
          automation_status:
            connection.github_installation_id && githubAppConfigured()
              ? "configured"
              : connection.automation_status,
        })
        .eq("id", connection.id);

      if (error) throw error;

      return res.status(200).json({
        deployToken,
        workflowFile: connection.workflow_file || GITHUB_WORKFLOW_FILE,
        secretName: GITHUB_DEPLOY_SECRET_NAME,
        tokenLastFour: lastFour(deployToken),
        automated: connection.github_installation_id && githubAppConfigured(),
        workflowYaml,
      });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return errorResponse(res, error);
  }
}
