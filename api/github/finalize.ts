import { requireProjectDeployAuth } from "../_lib/deploy-token";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { assertDeployable } from "../_lib/normalize";
import { mirrorDeploymentToShelby } from "../_lib/shelby";
import { getSupabaseAdmin, projectUrl, versionUrl } from "../_lib/supabase";

type FinalizePayload = {
  slug: string;
  hash: string;
  commitSha?: string;
  files: Array<{ name: string; size: number; type: string; path: string }>;
  buildOutput?: string;
  message?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson<FinalizePayload>(req);
    if (!body.slug) throw new Error("Project slug is required");
    if (!body.hash) throw new Error("Deployment hash is required");

    const { project } = await requireProjectDeployAuth(req, body.slug);
    const files = assertDeployable(body.files || [], body.buildOutput || "dist");
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const url = versionUrl(body.hash);
    const supabase = getSupabaseAdmin();
    const storage = await mirrorDeploymentToShelby({
      supabase,
      hash: body.hash,
      files,
      buildOutput: body.buildOutput || project.build_output,
    });

    const { error: projectError } = await supabase
      .from("shelby_projects")
      .update({
        content_hash: body.hash,
        latest_version_url: url,
        storage_backend: storage.storageBackend,
        shelby_owner_address: storage.ownerAddress,
        shelby_manifest: storage.manifest,
        shelby_uploaded_at: storage.uploadedAt,
        shelby_upload_error: storage.error,
        status: "live",
        files,
        size_bytes: totalSize,
        deployed_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (projectError) throw projectError;

    const { error: deploymentError } = await supabase.from("shelby_deployments").insert({
      project_id: project.id,
      content_hash: body.hash,
      version_url: url,
      storage_backend: storage.storageBackend,
      shelby_owner_address: storage.ownerAddress,
      shelby_manifest: storage.manifest,
      shelby_uploaded_at: storage.uploadedAt,
      shelby_upload_error: storage.error,
      status: "succeeded",
      trigger: "github-push",
      message: body.message || `GitHub deploy ${body.commitSha || ""}`.trim(),
    });

    if (deploymentError) throw deploymentError;

    await supabase
      .from("shelby_domain_mappings")
      .update({ content_hash: body.hash })
      .eq("project_id", project.id);

    return res.status(200).json({
      ok: true,
      versionUrl: url,
      publicUrl: projectUrl(project.slug),
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
