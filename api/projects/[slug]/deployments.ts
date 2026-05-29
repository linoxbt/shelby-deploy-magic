import { requireAuth } from "../../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../../_lib/http";
import { assertDeployable, normalizeContentHash } from "../../_lib/normalize";
import { mirrorDeploymentToShelby } from "../../_lib/shelby";
import { getOwnedProject, getSupabaseAdmin, versionUrl } from "../../_lib/supabase";

type DeploymentPayload = {
  hash: string;
  files: Array<{ name: string; size: number; type: string; path: string }>;
  buildOutput?: string;
  message?: string;
  trigger?: "manual" | "settings" | "github-push" | "domain" | "hash";
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const auth = await requireAuth(req);
    const slug = req.query.slug as string;
    const body = await readJson<DeploymentPayload>(req);
    if (!body.hash) throw new Error("Deployment hash is required");
    const hash = normalizeContentHash(body.hash);

    const supabase = getSupabaseAdmin();
    const project = await getOwnedProject(auth.userId, slug);
    const files = assertDeployable(body.files || [], body.buildOutput || project.build_output);
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const url = versionUrl(hash);
    const storage = await mirrorDeploymentToShelby({
      supabase,
      hash,
      files,
      buildOutput: body.buildOutput || project.build_output,
    });

    const { error: deploymentError } = await supabase.from("shelby_deployments").insert({
      project_id: project.id,
      content_hash: hash,
      version_url: url,
      storage_backend: storage.storageBackend,
      shelby_owner_address: storage.ownerAddress,
      shelby_manifest: storage.manifest,
      shelby_uploaded_at: storage.uploadedAt,
      shelby_upload_error: storage.error,
      status: "succeeded",
      trigger: body.trigger || "manual",
      message: body.message || "Manual deployment",
    });

    if (deploymentError) throw deploymentError;

    const { error: projectError } = await supabase
      .from("shelby_projects")
      .update({
        content_hash: hash,
        latest_version_url: url,
        storage_backend: storage.storageBackend,
        shelby_owner_address: storage.ownerAddress,
        shelby_manifest: storage.manifest,
        shelby_uploaded_at: storage.uploadedAt,
        shelby_upload_error: storage.error,
        deployed_at: new Date().toISOString(),
        size_bytes: totalSize,
        status: "live",
        files,
      })
      .eq("id", project.id)
      .eq("owner_id", auth.userId);

    if (projectError) throw projectError;

    await supabase
      .from("shelby_domain_mappings")
      .update({ content_hash: hash })
      .eq("project_id", project.id);

    return res.status(201).json({ ok: true, versionUrl: url });
  } catch (error) {
    return errorResponse(res, error);
  }
}
