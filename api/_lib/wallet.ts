import crypto from "node:crypto";
import { Account } from "@aptos-labs/ts-sdk";

type SupabaseAdmin = ReturnType<typeof import("./supabase").getSupabaseAdmin>;

export type WalletRow = {
  id: string;
  owner_id: string;
  chain: string;
  wallet_provider: string;
  address: string;
  public_key?: string | null;
  private_key_encrypted?: string | null;
  managed?: boolean | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function encryptionKey() {
  const value =
    process.env.SHELBY_WALLET_ENCRYPTION_KEY ||
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Missing wallet encryption key");
  return crypto.createHash("sha256").update(value).digest();
}

export function encryptWalletSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptWalletSecret(value: string) {
  if (!value.startsWith("v1:")) return value;
  const [, ivValue, tagValue, encryptedValue] = value.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function ensureManagedAptosWallet(supabase: SupabaseAdmin, ownerId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("shelby_wallet_connections")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("chain", "aptos")
    .eq("wallet_provider", "shelby-vault")
    .eq("managed", true)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as WalletRow;

  const account = Account.generate();
  const { data, error } = await supabase
    .from("shelby_wallet_connections")
    .insert({
      owner_id: ownerId,
      chain: "aptos",
      wallet_provider: "shelby-vault",
      address: account.accountAddress.toString(),
      public_key: account.publicKey.toString(),
      private_key_encrypted: encryptWalletSecret(account.privateKey.toString()),
      managed: true,
      status: "connected",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as WalletRow;
}

export function serializeWallet(row: WalletRow | null | undefined, includePrivateKey = false) {
  if (!row) return null;
  return {
    id: row.id,
    chain: row.chain,
    provider: row.wallet_provider,
    wallet_provider: row.wallet_provider,
    address: row.address,
    public_key: row.public_key || null,
    publicKey: row.public_key || null,
    managed: Boolean(row.managed),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    privateKey:
      includePrivateKey && row.private_key_encrypted
        ? decryptWalletSecret(row.private_key_encrypted)
        : undefined,
  };
}
