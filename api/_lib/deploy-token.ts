import crypto from "node:crypto";

import { getSupabaseAdmin, type ProjectRow } from "./supabase";

type DeployAuthResult = {
  project: ProjectRow;
  globalToken: boolean;
};

function bearerToken(req: any) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  return typeof header === "string" && header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
}

export function generateDeployToken() {
  return `shd_${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashDeployToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function lastFour(value: string) {
  return value.slice(-4);
}

export async function requireProjectDeployAuth(req: any, slug: string): Promise<DeployAuthResult> {
  const token = bearerToken(req);
  if (!token) throw new Error("Unauthorized: missing deploy token");

  const supabase = getSupabaseAdmin();
  const { data: project, error: projectError } = await supabase
    .from("shelby_projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) throw new Error("Project not found");

  if (process.env.SHELBY_DEPLOY_TOKEN && token === process.env.SHELBY_DEPLOY_TOKEN) {
    return { project: project as ProjectRow, globalToken: true };
  }

  const { data: connections, error: connectionError } = await supabase
    .from("shelby_github_connections")
    .select("deploy_token_hash")
    .eq("project_id", project.id);

  if (connectionError) throw connectionError;

  const tokenHash = hashDeployToken(token);
  const authorized = (connections || []).some(
    (connection: any) => connection.deploy_token_hash === tokenHash,
  );

  if (!authorized) throw new Error("Unauthorized: invalid deploy token");
  return { project: project as ProjectRow, globalToken: false };
}
