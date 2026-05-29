import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

import { normalizeDeployPath, type FileEntryInput } from "./normalize";

const DEFAULT_TTL_DAYS = 365;

type SupabaseAdmin = ReturnType<typeof import("./supabase").getSupabaseAdmin>;

export type ShelbyMirrorResult = {
  storageBackend: "supabase" | "shelby";
  ownerAddress: string | null;
  manifest: ShelbyManifestEntry[];
  uploadedAt: string | null;
  error: string | null;
};

export type ShelbyManifestEntry = {
  path: string;
  blobName?: string;
  size?: number;
  type?: string;
  url: string;
};

function shelbyNetwork() {
  const value = (process.env.SHELBY_NETWORK || "testnet").toLowerCase();
  if (value === "shelbynet") return Network.SHELBYNET;
  if (value === "local") return Network.LOCAL;
  return Network.TESTNET;
}

function shelbyRpcBaseUrl() {
  if (process.env.SHELBY_RPC_URL) return process.env.SHELBY_RPC_URL.replace(/\/+$/, "");
  return shelbyNetwork() === Network.SHELBYNET
    ? "https://api.shelbynet.shelby.xyz/shelby"
    : "https://api.testnet.shelby.xyz/shelby";
}

function encodeBlobName(blobName: string) {
  return blobName
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function shelbyBlobUrl(ownerAddress: string, blobName: string) {
  return `${shelbyRpcBaseUrl()}/v1/blobs/${ownerAddress}/${encodeBlobName(blobName)}`;
}

export function shelbyStorageEnabled() {
  return process.env.SHELBY_STORAGE_ENABLED === "true";
}

export function shelbyStorageConfigured() {
  return Boolean(process.env.SHELBY_API_KEY && process.env.SHELBY_PRIVATE_KEY);
}

export function shelbyStorageRequired() {
  return process.env.SHELBY_STORAGE_REQUIRED === "true";
}

export function shelbyStatus() {
  return {
    enabled: shelbyStorageEnabled(),
    configured: shelbyStorageConfigured(),
    required: shelbyStorageRequired(),
    network: shelbyNetwork(),
    rpcUrl: shelbyRpcBaseUrl(),
  };
}

function shelbyClient() {
  if (!process.env.SHELBY_API_KEY) {
    throw new Error("Missing required environment variable: SHELBY_API_KEY");
  }
  return new ShelbyNodeClient({
    network: shelbyNetwork(),
    apiKey: process.env.SHELBY_API_KEY,
    orderless: process.env.SHELBY_ORDERLESS === "true",
  });
}

function shelbySigner() {
  if (!process.env.SHELBY_PRIVATE_KEY) {
    throw new Error("Missing required environment variable: SHELBY_PRIVATE_KEY");
  }
  return Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(process.env.SHELBY_PRIVATE_KEY),
  });
}

function ttlMicros() {
  const ttlDays = Number(process.env.SHELBY_BLOB_TTL_DAYS || DEFAULT_TTL_DAYS);
  const safeTtlDays = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_TTL_DAYS;
  return Math.floor((Date.now() + safeTtlDays * 24 * 60 * 60 * 1000) * 1000);
}

function blobNameFor(hash: string, deployPath: string) {
  const path = deployPath.replace(/^\/+/, "");
  return `deployments/${hash}/${path || "index.html"}`;
}

async function downloadStagedAsset({
  supabase,
  hash,
  path,
}: {
  supabase: SupabaseAdmin;
  hash: string;
  path: string;
}) {
  const storagePath = `${hash}${path}`;
  const { data, error } = await supabase.storage.from("shelby_nodes").download(storagePath);
  if (error) throw error;
  if (!data) throw new Error(`Staged asset not found: ${storagePath}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function mirrorDeploymentToShelby({
  supabase,
  hash,
  files,
  buildOutput,
}: {
  supabase: SupabaseAdmin;
  hash: string;
  files: FileEntryInput[];
  buildOutput?: string;
}): Promise<ShelbyMirrorResult> {
  if (!shelbyStorageEnabled()) {
    return {
      storageBackend: "supabase",
      ownerAddress: null,
      manifest: [],
      uploadedAt: null,
      error: null,
    };
  }

  try {
    if (!shelbyStorageConfigured()) {
      throw new Error(
        "Shelby storage is enabled but SHELBY_API_KEY or SHELBY_PRIVATE_KEY is missing",
      );
    }

    const client = shelbyClient();
    const signer = shelbySigner();
    const ownerAddress = signer.accountAddress.toString();
    const expirationMicros = ttlMicros();
    const manifest: ShelbyMirrorResult["manifest"] = [];

    for (const file of files) {
      const deployPath = normalizeDeployPath(file.path || file.name, buildOutput || "dist");
      const blobData = await downloadStagedAsset({ supabase, hash, path: deployPath });
      const blobName = blobNameFor(hash, deployPath);
      await client.upload({
        signer,
        blobData,
        blobName,
        expirationMicros,
      });
      manifest.push({
        path: deployPath,
        blobName,
        size: file.size || blobData.byteLength,
        type: file.type || "application/octet-stream",
        url: shelbyBlobUrl(ownerAddress, blobName),
      });
    }

    return {
      storageBackend: "shelby",
      ownerAddress,
      manifest,
      uploadedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shelby mirror failed";
    if (shelbyStorageRequired()) throw new Error(message);
    console.error("Shelby mirror failed:", error);
    return {
      storageBackend: "supabase",
      ownerAddress: null,
      manifest: [],
      uploadedAt: null,
      error: message,
    };
  }
}

export function shelbyManifestUrl(
  manifest: ShelbyMirrorResult["manifest"] | null | undefined,
  path: string,
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return manifest?.find((entry) => entry.path === normalizedPath)?.url || null;
}
