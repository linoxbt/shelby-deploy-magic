import { requireProjectDeployAuth } from "../_lib/deploy-token";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { assertDeployable, normalizeContentHash, normalizeDeployPath } from "../_lib/normalize";
import { getSupabaseAdmin } from "../_lib/supabase";

type UploadUrlPayload = {
  slug: string;
  hash: string;
  buildOutput?: string;
  files: Array<{ name: string; size: number; type: string; path: string }>;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson<UploadUrlPayload>(req);
    if (!body.slug) throw new Error("Project slug is required");
    if (!body.hash) throw new Error("Deployment hash is required");
    const hash = normalizeContentHash(body.hash);

    const { project } = await requireProjectDeployAuth(req, body.slug);
    const buildOutput = body.buildOutput || project.build_output || "dist";
    const files = assertDeployable(body.files || [], buildOutput);
    const supabase = getSupabaseAdmin();

    const uploads = await Promise.all(
      files.map(async (file) => {
        const deployPath = normalizeDeployPath(file.path, buildOutput);
        const storagePath = `${hash}${deployPath}`;
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

    return res.status(200).json({ projectId: project.id, files: uploads });
  } catch (error) {
    return errorResponse(res, error);
  }
}
