import { decryptToken, fetchGithubRepos } from "../_lib/github";
import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed } from "../_lib/http";
import { getSupabaseAdmin } from "../_lib/supabase";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const auth = await requireAuth(req);
    const supabase = getSupabaseAdmin();
    const { data: account, error } = await supabase
      .from("shelby_github_accounts")
      .select("access_token_encrypted, login, avatar_url, html_url")
      .eq("owner_id", auth.userId)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!account) return res.status(200).json({ repos: [], account: null });

    const repos = await fetchGithubRepos(decryptToken(account.access_token_encrypted));
    return res.status(200).json({
      account: {
        login: account.login,
        avatar_url: account.avatar_url,
        html_url: account.html_url,
      },
      repos,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
