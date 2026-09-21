import { randomBytes, createHash } from "node:crypto";
import { requireAuth } from "../../_lib/auth";
import { getSupabaseAdmin } from "../../_lib/supabase";
import { requireEnv } from "../../_lib/env";
import { errorResponse, methodNotAllowed } from "../../_lib/http";
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const auth = await requireAuth(req),
      state = randomBytes(32).toString("hex"),
      base = requireEnv("SHELBY_APP_URL");
    const { error } = await getSupabaseAdmin()
      .from("shelby_github_oauth_states")
      .insert({
        state: createHash("sha256").update(state).digest("hex"),
        owner_id: auth.userId,
        expires_at: new Date(Date.now() + 600000).toISOString(),
        redirect_to: "/settings",
      });
    if (error) throw error;
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", requireEnv("GITHUB_CLIENT_ID"));
    url.searchParams.set("redirect_uri", `${base}/api/github/oauth/callback`);
    url.searchParams.set("scope", "repo read:user workflow");
    url.searchParams.set("state", state);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ url: url.toString() });
  } catch (error) {
    return errorResponse(res, error);
  }
}
