import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import { getRequestHost, getRequestUrl, useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface GithubSessionData {
  ownerId?: string;
  githubAccountId?: string;
  githubLogin?: string;
}

export interface GithubAccount {
  id: string;
  github_user_id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  html_url: string | null;
  account_type: string;
  scopes: string[];
  connected_at: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  pushedAt: string | null;
  language: string | null;
}

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function encryptionKey() {
  return createHash("sha256").update(requireEnv("GITHUB_TOKEN_ENCRYPTION_SECRET")).digest();
}

export function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(payload: string) {
  const [iv, tag, encrypted] = payload.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Stored GitHub token is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function getOrigin() {
  const configured = process.env.SITE_URL || process.env.URL;
  if (configured) return configured.replace(/\/$/, "");
  const url = getRequestUrl();
  if (url?.origin) return url.origin;
  return `https://${getRequestHost()}`;
}

export async function getGithubSession() {
  return useSession<GithubSessionData>({
    name: "shelby-github-session",
    password: requireEnv("GITHUB_TOKEN_ENCRYPTION_SECRET"),
    cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  });
}

export async function ensureGithubOwnerId() {
  const session = await getGithubSession();
  const ownerId = session.data.ownerId ?? randomUUID();
  if (!session.data.ownerId) await session.update({ ...session.data, ownerId });
  return { session, ownerId };
}

export async function createGithubAuthUrl(redirectTo: string) {
  const clientId = requireEnv("GITHUB_OAUTH_CLIENT_ID");
  const { ownerId } = await ensureGithubOwnerId();
  const state = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await (supabaseAdmin as any).from("shelby_github_oauth_states").insert({
    state,
    owner_id: ownerId,
    redirect_to: redirectTo || "/dashboard",
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Could not prepare GitHub sign-in: ${error.message}`);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getOrigin()}/api/public/github/callback`,
    scope: "read:user user:email repo",
    state,
    allow_signup: "true",
  });

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code: string) {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("GITHUB_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GITHUB_OAUTH_CLIENT_SECRET"),
      code,
      redirect_uri: `${getOrigin()}/api/public/github/callback`,
    }),
  });
  const data = (await response.json()) as { access_token?: string; scope?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "GitHub did not return an access token");
  return { token: data.access_token, scopes: data.scope ? data.scope.split(",").filter(Boolean) : [] };
}

async function githubFetch<T>(path: string, token: string) {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub request failed [${response.status}]: ${JSON.stringify(data)}`);
  return data as T;
}

export async function completeGithubOAuth(code: string, state: string) {
  const session = await getGithubSession();
  if (!session.data.ownerId) throw new Error("GitHub sign-in session expired");

  const { data: stateRow, error: stateError } = await (supabaseAdmin as any)
    .from("shelby_github_oauth_states")
    .select("state, owner_id, redirect_to, expires_at")
    .eq("state", state)
    .eq("owner_id", session.data.ownerId)
    .single();

  if (stateError || !stateRow) throw new Error("GitHub sign-in state could not be verified");
  if (new Date(stateRow.expires_at).getTime() < Date.now()) throw new Error("GitHub sign-in state expired");

  const { token, scopes } = await exchangeCodeForToken(code);
  const user = await githubFetch<{ id: number; login: string; name: string | null; avatar_url: string | null; html_url: string | null; type: string }>("/user", token);
  const encryptedToken = encryptToken(token);

  const { data: account, error } = await (supabaseAdmin as any)
    .from("shelby_github_accounts")
    .upsert(
      {
        owner_id: session.data.ownerId,
        github_user_id: user.id,
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        account_type: user.type,
        scopes,
        access_token_encrypted: encryptedToken,
        token_last_four: token.slice(-4),
        connected_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,github_user_id" },
    )
    .select("id, login")
    .single();

  if (error || !account) throw new Error(`Could not save GitHub account: ${error?.message ?? "Unknown error"}`);
  await (supabaseAdmin as any).from("shelby_github_oauth_states").delete().eq("state", state);
  await session.update({ ...session.data, githubAccountId: account.id, githubLogin: account.login });
  return stateRow.redirect_to as string;
}

export async function getConnectedGithubAccount() {
  const session = await getGithubSession();
  if (!session.data.ownerId || !session.data.githubAccountId) return null;
  const { data, error } = await (supabaseAdmin as any)
    .from("shelby_github_accounts")
    .select("id, github_user_id, login, name, avatar_url, html_url, account_type, scopes, connected_at")
    .eq("owner_id", session.data.ownerId)
    .eq("id", session.data.githubAccountId)
    .single();
  if (error || !data) return null;
  return data as GithubAccount;
}

export async function listGithubRepositories() {
  const session = await getGithubSession();
  if (!session.data.ownerId || !session.data.githubAccountId) throw new Response("GitHub is not connected", { status: 401 });

  const { data: account, error } = await (supabaseAdmin as any)
    .from("shelby_github_accounts")
    .select("access_token_encrypted")
    .eq("owner_id", session.data.ownerId)
    .eq("id", session.data.githubAccountId)
    .single();

  if (error || !account) throw new Response("GitHub account was not found", { status: 404 });
  const token = decryptToken(account.access_token_encrypted);
  const repos = await githubFetch<Array<{ id: number; name: string; full_name: string; owner: { login: string }; private: boolean; default_branch: string; html_url: string; pushed_at: string | null; language: string | null }>>(
    "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member",
    token,
  );

  return repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    private: repo.private,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    pushedAt: repo.pushed_at,
    language: repo.language,
  })) satisfies GithubRepo[];
}
