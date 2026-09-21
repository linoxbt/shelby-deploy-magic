import { requireAuth, requireAptosAddress, type AuthContext } from "./_lib/auth";
import { getSupabaseAdmin } from "./_lib/supabase";
import { errorResponse, methodNotAllowed, readJson } from "./_lib/http";
export async function connectedWallet(auth: AuthContext, address = auth.aptosAddresses[0]) {
  if (!address) return null;
  const verified = requireAptosAddress(auth, address);
  const { data, error } = await getSupabaseAdmin()
    .from("shelby_wallet_connections")
    .upsert(
      {
        owner_id: auth.userId,
        chain: "aptos",
        address: verified,
        wallet_provider: "dynamic-aptos",
        status: "connected",
        managed: false,
      },
      { onConflict: "owner_id,chain,address" },
    )
    .select("id,chain,address,wallet_provider,status,managed")
    .single();
  if (error) throw error;
  return { ...data, provider: data.wallet_provider };
}
export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET") return res.status(200).json({ wallet: await connectedWallet(auth) });
    if (req.method === "POST") {
      const body = await readJson<any>(req);
      return res
        .status(200)
        .json({ wallet: await connectedWallet(auth, String(body.address || "")) });
    }
    if (req.method === "DELETE") {
      const address = requireAptosAddress(auth, String(req.query.address || ""));
      const { error } = await getSupabaseAdmin()
        .from("shelby_wallet_connections")
        .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
        .eq("owner_id", auth.userId)
        .eq("address", address)
        .eq("managed", false);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  } catch (error) {
    return errorResponse(res, error);
  }
}
