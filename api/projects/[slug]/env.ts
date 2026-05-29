import { requireAuth } from "../../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../../_lib/http";
import { getOwnedProject, getSupabaseAdmin } from "../../_lib/supabase";
import { encryptWalletSecret } from "../../_lib/wallet";

type EnvPayload = {
  id?: string;
  key?: string;
  value?: string;
  target?: "production" | "preview" | "development";
};

function normalizeKey(key: string) {
  const normalized = key.trim().toUpperCase();
  if (!/^[A-Z_][A-Z0-9_]*$/.test(normalized)) {
    throw new Error("Environment variable keys must use A-Z, 0-9, and underscores");
  }
  return normalized;
}

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const slug = req.query.slug as string;
    const supabase = getSupabaseAdmin();
    const project = await getOwnedProject(auth.userId, slug);

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("shelby_project_env_vars")
        .select("id, key, target, created_at, updated_at")
        .eq("project_id", project.id)
        .order("key", { ascending: true });

      if (error) throw error;
      return res.status(200).json({
        env: (data || []).map((item) => ({ ...item, hasValue: true })),
      });
    }

    if (req.method === "POST") {
      const body = await readJson<EnvPayload>(req);
      if (!body.key) throw new Error("Environment variable key is required");
      if (typeof body.value !== "string" || body.value.length === 0) {
        throw new Error("Environment variable value is required");
      }
      const key = normalizeKey(body.key);
      const target = body.target || "production";
      const { data, error } = await supabase
        .from("shelby_project_env_vars")
        .upsert(
          {
            project_id: project.id,
            key,
            target,
            value_encrypted: encryptWalletSecret(body.value),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,key,target" },
        )
        .select("id, key, target, created_at, updated_at")
        .single();

      if (error) throw error;
      return res.status(200).json({ env: { ...data, hasValue: true } });
    }

    if (req.method === "DELETE") {
      const body = await readJson<EnvPayload>(req);
      const id = body.id || String(req.query.id || "");
      if (!id) throw new Error("Environment variable id is required");
      const { error } = await supabase
        .from("shelby_project_env_vars")
        .delete()
        .eq("project_id", project.id)
        .eq("id", id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  } catch (error) {
    return errorResponse(res, error);
  }
}
