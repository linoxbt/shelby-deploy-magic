import { requireProjectDeployAuth } from "../_lib/deploy-token";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { getSupabaseAdmin } from "../_lib/supabase";
import { decryptWalletSecret } from "../_lib/wallet";

type EnvPayload = {
  slug: string;
  target?: "production" | "preview";
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson<EnvPayload>(req);
    if (!body.slug) throw new Error("Project slug is required");
    const { project } = await requireProjectDeployAuth(req, body.slug);
    const target = body.target || "production";
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("shelby_project_env_vars")
      .select("key, value_encrypted")
      .eq("project_id", project.id)
      .eq("target", target);

    if (error) throw error;
    const env = Object.fromEntries(
      (data || []).map((item) => [item.key, decryptWalletSecret(item.value_encrypted)]),
    );

    return res.status(200).json({ env });
  } catch (error) {
    return errorResponse(res, error);
  }
}
