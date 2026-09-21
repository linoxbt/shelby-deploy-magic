import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { requireAuth, requireAptosAddress } from "./_lib/auth";
import { verifyDeploymentTransactions, verifyDeploymentFee, requireEnv } from "./_lib/aptos";
import { getOwnedProject, getSupabaseAdmin } from "./_lib/supabase";
import { errorResponse, methodNotAllowed, readJson } from "./_lib/http";
import { shelbyBlobUrl } from "./_lib/shelby";
import { boundedBody } from "./_lib/bounded-body";
export default async function handler(req: any, res: any) {
  try {
    if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, ["GET", "POST"]);
    const auth = await requireAuth(req),
      body = req.method === "GET" ? req.query : await readJson<any>(req);
    const project: any = await getOwnedProject(auth.userId, String(body.slug || "")),
      db = getSupabaseAdmin();
    requireAptosAddress(auth, project.wallet_address);
    if (project.signer_mode !== "connected") throw Error("This project uses a legacy signer");
    const id = z.string().uuid().parse(body.deploymentId);
    const { data: deployment, error } = await db
      .from("shelby_deployments")
      .select("*")
      .eq("id", id)
      .eq("project_id", project.id)
      .single();
    if (error || !deployment) throw Error("Deployment not found");
    if (deployment.status !== "awaiting_signature" || project.desired_deployment_id !== id)
      throw Error("Deployment is no longer awaiting publication");
    res.setHeader("Cache-Control", "no-store");
    const config = {
      walletAddress: project.wallet_address,
      projectName: project.name,
      contentHash: deployment.content_hash,
      paymentTxHash: project.payment_tx_hash,
      network: process.env.APTOS_NETWORK || "testnet",
      treasury: requireEnv("TREASURY_ADDRESS"),
      registry: requireEnv("REGISTRY_ADDRESS"),
      coinType: requireEnv("USDT_COIN_TYPE"),
      fee: process.env.DEPLOY_FEE || "10000",
    };
    if (req.method === "GET") return res.status(200).json(config);
    const paymentTxHash = z
      .string()
      .regex(/^0x[0-9a-f]{64}$/i)
      .parse(project.payment_tx_hash || body.paymentTxHash);
    if (body.action === "record-fee") {
      await verifyDeploymentFee(project.wallet_address, paymentTxHash);
      const result = await db.rpc("shelby_record_fee", {
        p_project: project.id,
        p_owner: auth.userId,
        p_payment: paymentTxHash,
      });
      if (result.error) throw result.error;
      return res.status(200).json({ paymentTxHash });
    }
    const registryTxHash = z
      .string()
      .regex(/^0x[0-9a-f]{64}$/i)
      .parse(body.registryTxHash);
    await verifyDeploymentTransactions({ ...config, paymentTxHash, registryTxHash });
    // Approval can happen long after building: re-read storage before promotion.
    const stored = await fetch(
      shelbyBlobUrl(
        deployment.shelby_owner_address,
        `releases/${project.id}/${id}/${deployment.content_hash}/.shelby-manifest.json`,
      ),
      {
        headers: { Authorization: `Bearer ${requireEnv("SHELBY_API_KEY")}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!stored.ok) throw Error(`Shelby publication check returned ${stored.status}`);
    const manifest = JSON.parse((await boundedBody(stored, 16 * 1024 * 1024)).toString());
    if (
      manifest.deploymentId !== id ||
      manifest.projectId !== project.id ||
      manifest.hash !== deployment.content_hash ||
      !isDeepStrictEqual(manifest.files, deployment.shelby_manifest)
    )
      throw Error("Stored manifest failed integrity verification");
    const result = await db.rpc("shelby_wallet_publish", {
      p_id: id,
      p_owner: auth.userId,
      p_payment: paymentTxHash,
      p_registry: registryTxHash,
    });
    if (result.error) throw result.error;
    return res.status(200).json({ published: result.data === true });
  } catch (e) {
    return errorResponse(
      res,
      e instanceof Error ? e : new Error((e as any)?.message || "Publication failed"),
    );
  }
}
