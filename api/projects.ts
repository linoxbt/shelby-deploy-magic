import { requireAuth } from "./_lib/auth";
import { verifyDeploymentTransactions } from "./_lib/aptos";
import { errorResponse, methodNotAllowed, readJson } from "./_lib/http";
import { assertDeployable, normalizeContentHash, normalizeSlug } from "./_lib/normalize";
import { mirrorDeploymentToShelby } from "./_lib/shelby";
import { getSupabaseAdmin, isSlugAvailable, versionUrl } from "./_lib/supabase";
import { ensureManagedAptosWallet, serializeWallet } from "./_lib/wallet";

type ProjectPayload = {
  name: string;
  slug?: string;
  description?: string;
  files?: Array<{ name: string; size: number; type: string; path: string }>;
  size?: number;
  hash: string;
  source?: "drag-drop" | "github";
  framework?: string;
  buildOutput?: string;
  chain?: "aptos" | "shelby";
  walletAddress?: string;
  message?: string;
  paymentTxHash?: string;
  registryTxHash?: string;
};

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("shelby_projects")
        .select(
          `
          *,
          shelby_deployments (*),
          shelby_domain_mappings (*),
          shelby_github_connections (*),
          shelby_preview_deployments (*),
          shelby_build_logs (*)
        `,
        )
        .eq("owner_id", auth.userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const wallet = await ensureManagedAptosWallet(supabase, auth.userId);

      return res.status(200).json({ projects: data || [], wallet: serializeWallet(wallet) });
    }

    if (req.method === "POST") {
      const body = await readJson<ProjectPayload>(req);
      if (!body.name?.trim()) throw new Error("Project name is required");
      if (!body.hash) throw new Error("Deployment hash is required");
      const hash = normalizeContentHash(body.hash);

      const buildOutput = body.buildOutput || "dist";
      const slug = normalizeSlug(body.slug || body.name);
      if (!(await isSlugAvailable(slug))) {
        throw new Error(`The subdomain ${slug}.shelbyhost.xyz is already taken`);
      }

      const files = assertDeployable(body.files || [], buildOutput);
      const size = body.size ?? files.reduce((sum, file) => sum + (file.size || 0), 0);
      const latestVersionUrl = versionUrl(hash);

      await verifyDeploymentTransactions({
        walletAddress: body.walletAddress,
        projectName: body.name.trim(),
        contentHash: hash,
        paymentTxHash: body.paymentTxHash,
        registryTxHash: body.registryTxHash,
      });

      const storage = await mirrorDeploymentToShelby({
        supabase,
        hash,
        files,
        buildOutput,
      });

      const { data: project, error } = await supabase
        .from("shelby_projects")
        .insert({
          owner_id: auth.userId,
          name: body.name.trim(),
          slug,
          description: body.description || "",
          status: "live",
          source: body.source || "drag-drop",
          chain: body.chain || "aptos",
          wallet_address: body.walletAddress || null,
          framework: body.framework || "vite",
          build_output: buildOutput,
          content_hash: hash,
          latest_version_url: latestVersionUrl,
          storage_backend: storage.storageBackend,
          shelby_owner_address: storage.ownerAddress,
          shelby_manifest: storage.manifest,
          shelby_uploaded_at: storage.uploadedAt,
          shelby_upload_error: storage.error,
          size_bytes: size,
          files,
          deployed_at: new Date().toISOString(),
          payment_tx_hash: body.paymentTxHash || null,
          registry_tx_hash: body.registryTxHash || null,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: deploymentError } = await supabase.from("shelby_deployments").insert({
        project_id: project.id,
        content_hash: hash,
        version_url: latestVersionUrl,
        storage_backend: storage.storageBackend,
        shelby_owner_address: storage.ownerAddress,
        shelby_manifest: storage.manifest,
        shelby_uploaded_at: storage.uploadedAt,
        shelby_upload_error: storage.error,
        status: "succeeded",
        trigger: body.source === "github" ? "github-push" : "manual",
        message: body.message || "Initial deployment",
      });

      if (deploymentError) throw deploymentError;

      return res.status(201).json({ project });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return errorResponse(res, error);
  }
}
