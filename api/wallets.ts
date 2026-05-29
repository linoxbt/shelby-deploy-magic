import { requireAuth } from "./_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase";
import { ensureManagedAptosWallet, serializeWallet } from "./_lib/wallet";

type WalletPayload = {
  chain: "aptos" | "shelby";
  address: string;
  provider: string;
};

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const wallet = await ensureManagedAptosWallet(supabase, auth.userId);
      return res.status(200).json({
        wallet: serializeWallet(wallet, req.query.includePrivateKey === "true"),
      });
    }

    if (req.method === "DELETE") {
      const address = String(req.query.address || "");
      if (!address) throw new Error("Wallet address is required");
      const { data: wallet, error: walletError } = await supabase
        .from("shelby_wallet_connections")
        .select("managed, wallet_provider")
        .eq("owner_id", auth.userId)
        .eq("address", address)
        .maybeSingle();
      if (walletError) throw walletError;
      if (wallet?.managed || wallet?.wallet_provider === "shelby-vault") {
        throw new Error("Managed Aptos accounts are part of the ShelbyHost profile and cannot be disconnected");
      }
      const { error } = await supabase
        .from("shelby_wallet_connections")
        .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
        .eq("owner_id", auth.userId)
        .eq("address", address);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST", "DELETE"]);

    const body = await readJson<WalletPayload>(req);
    if (!body.address) throw new Error("Wallet address is required");

    const { data, error } = await supabase
      .from("shelby_wallet_connections")
      .upsert(
        {
          owner_id: auth.userId,
          chain: body.chain,
          address: body.address,
          wallet_provider: body.provider,
          status: "connected",
        },
        { onConflict: "owner_id,chain,address" },
      )
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ wallet: serializeWallet(data as any) });
  } catch (error) {
    return errorResponse(res, error);
  }
}
