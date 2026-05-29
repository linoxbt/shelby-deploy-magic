import { getGithubUser, encryptToken } from "../_lib/github";
import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { getSupabaseAdmin } from "../_lib/supabase";

type GithubAccountPayload = {
  accessToken: string;
  scopes?: string[];
};

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "DELETE") {
      const { error } = await supabase
        .from("shelby_github_accounts")
        .delete()
        .eq("owner_id", auth.userId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") return methodNotAllowed(res, ["POST", "DELETE"]);

    const body = await readJson<GithubAccountPayload>(req);
    if (!body.accessToken) throw new Error("GitHub access token is required");

    const ghUser = await getGithubUser(body.accessToken);
    const encrypted = encryptToken(body.accessToken);
    const tokenLastFour = body.accessToken.slice(-4);

    const { data, error } = await supabase
      .from("shelby_github_accounts")
      .upsert(
        {
          owner_id: auth.userId,
          github_user_id: ghUser.id,
          login: ghUser.login,
          name: ghUser.name,
          avatar_url: ghUser.avatar_url,
          html_url: ghUser.html_url,
          account_type: ghUser.type || "User",
          scopes: body.scopes || [],
          access_token_encrypted: encrypted,
          token_last_four: tokenLastFour,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,github_user_id" },
      )
      .select("login, avatar_url, html_url, token_last_four")
      .single();

    if (error) throw error;
    return res.status(200).json({ account: data });
  } catch (error) {
    return errorResponse(res, error);
  }
}
