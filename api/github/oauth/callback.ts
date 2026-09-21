import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../../_lib/supabase";
import { requireEnv } from "../../_lib/env";
import { getGithubUser, encryptToken } from "../../_lib/github";
import { errorResponse, methodNotAllowed } from "../../_lib/http";
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const state = String(req.query.state || ""),
      code = String(req.query.code || "");
    if (!/^[a-f0-9]{64}$/.test(state) || !code || code.length > 1000)
      throw Error("Invalid OAuth callback");
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("shelby_github_oauth_states")
      .delete()
      .eq("state", createHash("sha256").update(state).digest("hex"))
      .gt("expires_at", new Date().toISOString())
      .select("owner_id")
      .single();
    if (error || !data) throw Error("OAuth state expired or already used");
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: requireEnv("GITHUB_CLIENT_ID"),
        client_secret: requireEnv("GITHUB_CLIENT_SECRET"),
        code,
        redirect_uri: `${requireEnv("SHELBY_APP_URL")}/api/github/oauth/callback`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || !result.access_token) throw Error("GitHub token exchange failed");
    const user = await getGithubUser(result.access_token);
    const saved = await db.from("shelby_github_accounts").upsert(
      {
        owner_id: data.owner_id,
        github_user_id: user.id,
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        account_type: user.type || "User",
        scopes: String(result.scope || "").split(","),
        access_token_encrypted: encryptToken(result.access_token),
        token_last_four: result.access_token.slice(-4),
        connected_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,github_user_id" },
    );
    if (saved.error) throw saved.error;
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(303, `${requireEnv("SHELBY_APP_URL")}/settings?github=connected`);
  } catch (error) {
    return errorResponse(res, error);
  }
}
