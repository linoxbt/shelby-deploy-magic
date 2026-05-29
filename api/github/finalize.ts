import { requireProjectDeployAuth } from "../_lib/deploy-token";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { assertDeployable, normalizeContentHash } from "../_lib/normalize";
import { mirrorDeploymentToShelby } from "../_lib/shelby";
import { getSupabaseAdmin, projectUrl, versionUrl } from "../_lib/supabase";

type FinalizePayload = {
  slug: string;
  hash: string;
  commitSha?: string;
  files: Array<{ name: string; size: number; type: string; path: string }>;
  buildOutput?: string;
  message?: string;
  preview?: boolean;
  source?: {
    branch?: string;
    pullRequestNumber?: number;
    repository?: string;
    ref?: string;
    runAttempt?: string;
    runId?: string;
    workflow?: string;
  };
};

function previewSlugFor(projectSlug: string, source?: FinalizePayload["source"]) {
  if (source?.pullRequestNumber) return `${projectSlug}-pr-${source.pullRequestNumber}`;
  const branch = (source?.branch || source?.ref || "preview").toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${projectSlug}-${branch}`.replace(/-+/g, "-").slice(0, 60);
}

async function writeBuildLogs({
  supabase,
  projectId,
  deploymentId,
  lines,
}: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  projectId: string;
  deploymentId?: string;
  lines: string[];
}) {
  await supabase.from("shelby_build_logs").insert(
    lines.map((line) => ({
      project_id: projectId,
      deployment_id: deploymentId || null,
      stream: "github-actions",
      line,
      level: line.toLowerCase().includes("failed") ? "error" : "info",
    })),
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJson<FinalizePayload>(req);
    if (!body.slug) throw new Error("Project slug is required");
    if (!body.hash) throw new Error("Deployment hash is required");
    const hash = normalizeContentHash(body.hash);

    const { project } = await requireProjectDeployAuth(req, body.slug);
    const files = assertDeployable(body.files || [], body.buildOutput || "dist");
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const url = versionUrl(hash);
    const supabase = getSupabaseAdmin();
    const isPreview = body.preview === true;
    const storage = await mirrorDeploymentToShelby({
      supabase,
      hash,
      files,
      buildOutput: body.buildOutput || project.build_output,
    });

    const { data: deployment, error: deploymentError } = await supabase
      .from("shelby_deployments")
      .insert({
        project_id: project.id,
        content_hash: hash,
        version_url: url,
        storage_backend: storage.storageBackend,
        shelby_owner_address: storage.ownerAddress,
        shelby_manifest: storage.manifest,
        shelby_uploaded_at: storage.uploadedAt,
        shelby_upload_error: storage.error,
        status: "succeeded",
        trigger: isPreview ? "github-pr" : "github-push",
        message:
          body.message ||
          `${isPreview ? "GitHub preview" : "GitHub deploy"} ${body.commitSha || ""}`.trim(),
      })
      .select("id")
      .single();

    if (deploymentError) throw deploymentError;

    await writeBuildLogs({
      supabase,
      projectId: project.id,
      deploymentId: deployment.id,
      lines: [
        `Repository ${body.source?.repository || "unknown"} checked out`,
        `Build output ${body.buildOutput || project.build_output} finalized with ${files.length} files`,
        `Artifact hash ${hash}`,
        storage.storageBackend === "shelby"
          ? `Shelby storage mirror completed for ${storage.ownerAddress}`
          : storage.error
            ? `Shelby storage mirror skipped: ${storage.error}`
            : "Supabase staging completed",
        isPreview ? "Preview deployment is ready" : "Production deployment is live",
      ],
    });

    if (isPreview) {
      const previewSlug = previewSlugFor(project.slug, body.source);
      const previewUrl = projectUrl(previewSlug);
      const { error: previewError } = await supabase.from("shelby_preview_deployments").upsert(
        {
          project_id: project.id,
          pull_request_number: body.source?.pullRequestNumber || null,
          branch: body.source?.branch || body.source?.ref || "preview",
          commit_sha: body.commitSha || null,
          content_hash: hash,
          preview_slug: previewSlug,
          preview_url: previewUrl,
          storage_backend: storage.storageBackend,
          shelby_owner_address: storage.ownerAddress,
          shelby_manifest: storage.manifest,
          shelby_uploaded_at: storage.uploadedAt,
          shelby_upload_error: storage.error,
          status: "ready",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "preview_slug" },
      );
      if (previewError) throw previewError;

      return res.status(200).json({
        ok: true,
        preview: true,
        versionUrl: url,
        publicUrl: previewUrl,
      });
    }

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
        status: "live",
        files,
        size_bytes: totalSize,
        deployed_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (projectError) throw projectError;

    await supabase
      .from("shelby_domain_mappings")
      .update({ content_hash: hash })
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
