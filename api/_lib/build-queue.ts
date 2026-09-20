import {
  buildConfigSchema,
  sourceSchema,
  validateSource,
  type BuildSource,
} from "./build-contract";
import { decryptToken } from "./github";
import { getSupabaseAdmin } from "./supabase";

export async function githubAccess(ownerId: string, repository: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new Error("Invalid GitHub repository");
  const db = getSupabaseAdmin();
  const { data: accounts, error } = await db
    .from("shelby_github_accounts")
    .select("access_token_encrypted")
    .eq("owner_id", ownerId)
    .order("connected_at", { ascending: false });
  if (error) throw error;
  const token = accounts?.[0] ? decryptToken(accounts[0].access_token_encrypted) : "";
  const response = await fetch(`https://api.github.com/repos/${repository}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      `GitHub repository is inaccessible (${response.status}). Connect an account with repository access.`,
    );
  const repo = await response.json();
  return { token, repo };
}
export async function frozenSource(ownerId: string, input: unknown): Promise<BuildSource> {
  const source = sourceSchema.parse(input);
  validateSource(source);
  if (source.kind === "github") {
    const { token } = await githubAccess(ownerId, source.repository);
    const response = await fetch(
      `https://api.github.com/repos/${source.repository}/commits/${encodeURIComponent(source.commit || source.branch)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error(`GitHub revision not found (${response.status})`);
    const commit = await response.json();
    source.commit = commit.sha;
  }
  return source;
}
export async function enqueueBuild(
  project: any,
  ownerId: string,
  source: BuildSource,
  config: unknown,
  eventKey?: string,
) {
  const db = getSupabaseAdmin();
  const validated = buildConfigSchema.parse(config);
  const { data: vars, error } = await db
    .from("shelby_project_env_vars")
    .select("key,value_encrypted")
    .eq("project_id", project.id)
    .eq("target", "production");
  if (error) throw error;
  const env = Object.fromEntries((vars || []).map((v) => [v.key, v.value_encrypted]));
  const { data, error: queueError } = await db.rpc("shelby_enqueue", {
    p_project: project.id,
    p_owner: ownerId,
    p_source: source,
    p_config: validated,
    p_env: env,
    p_event: eventKey || null,
  });
  if (queueError) throw queueError;
  return data as string;
}
