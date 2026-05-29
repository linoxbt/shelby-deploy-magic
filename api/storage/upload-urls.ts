import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { assertDeployable, normalizeDeployPath } from "../_lib/normalize";
import { getSupabaseAdmin } from "../_lib/supabase";

type UploadUrlPayload = {
  hash: string;
  buildOutput?: string;
  files: Array<{ name: string; size: number; type: string; path: string }>;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    await requireAuth(req);
    const body = await readJson<UploadUrlPayload>(req);
    if (!body.hash) throw new Error("Deployment hash is required");
    const files = assertDeployable(body.files || [], body.buildOutput || "dist");
    const supabase = getSupabaseAdmin();

    const uploads = await Promise.all(
      files.map(async (file) => {
        const deployPath = normalizeDeployPath(file.path, body.buildOutput || "dist");
        const storagePath = `${body.hash}${deployPath}`;
        const { data, error } = await supabase.storage
          .from("shelby_nodes")
          .createSignedUploadUrl(storagePath, { upsert: true });

        if (error) throw error;
        return {
          ...file,
          path: deployPath,
          storagePath,
          signedUrl: data.signedUrl,
          token: data.token,
        };
      }),
    );

    return res.status(200).json({ files: uploads });
  } catch (error) {
    return errorResponse(res, error);
  }
}
