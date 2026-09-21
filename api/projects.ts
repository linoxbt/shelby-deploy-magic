import { deploymentColumns } from "./_lib/build-contract";
import { requireAuth } from "./_lib/auth";
import { errorResponse, methodNotAllowed } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase";
import { connectedWallet } from "./wallets";

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("shelby_projects")
        .select(
          `
          id,owner_id,name,slug,description,framework,build_output,build_config,active_deployment_id,content_hash,source,status,latest_version_url,chain,wallet_address,files,size_bytes,deployed_at,created_at,updated_at,storage_backend,shelby_owner_address,shelby_uploaded_at,shelby_upload_error,registry_tx_hash,payment_tx_hash,
          shelby_deployments!shelby_deployments_project_id_fkey (${deploymentColumns}),
          shelby_domain_mappings (*),
          shelby_github_connections (*),
          shelby_preview_deployments (*)
        `,
        )
        .eq("owner_id", auth.userId)
        .order("created_at", { ascending: false })
        .order("created_at", { referencedTable: "shelby_deployments", ascending: false })
        .limit(100, { referencedTable: "shelby_deployments" });

      if (error) throw error;

      const wallet = await connectedWallet(auth);

      return res.status(200).json({ projects: data || [], wallet });
    }

    if (req.method === "POST") {
      return res.status(410).json({
        error:
          "Submit application source to /api/deployments. Direct artifact publication is no longer supported.",
      });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return errorResponse(res, error);
  }
}
