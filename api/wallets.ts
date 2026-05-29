import { requireAuth } from "./_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase";

type WalletPayload = {
  chain: "aptos" | "shelby";
  address: string;
  provider: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const auth = await requireAuth(req);
    const body = await readJson<WalletPayload>(req);
    if (!body.address) throw new Error("Wallet address is required");

    const supabase = getSupabaseAdmin();
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
    return res.status(200).json({ wallet: data });
  } catch (error) {
    return errorResponse(res, error);
  }
}
