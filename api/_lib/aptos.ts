import { requireEnv } from "./env";

type AptosTransaction = {
  success?: boolean;
  sender?: string;
  payload?: {
    function?: string;
    type_arguments?: string[];
    arguments?: unknown[];
  };
};

function normalizeAddress(address: string) {
  return address.toLowerCase().replace(/^0x0+/, "0x");
}

function aptosFullnodeUrl() {
  const network = process.env.APTOS_NETWORK || "testnet";
  if (process.env.APTOS_FULLNODE_URL) return process.env.APTOS_FULLNODE_URL;
  return network === "mainnet"
    ? "https://fullnode.mainnet.aptoslabs.com/v1"
    : "https://fullnode.testnet.aptoslabs.com/v1";
}

function aptosHeaders() {
  const apiKey = process.env.APTOS_API_KEY || process.env.SHELBY_API_KEY;
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
}

async function fetchTransaction(hash: string): Promise<AptosTransaction> {
  const response = await fetch(`${aptosFullnodeUrl()}/transactions/by_hash/${hash}`, {
    headers: aptosHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Aptos transaction ${hash} was not found`);
  }
  return response.json();
}

export async function verifyDeploymentTransactions({
  walletAddress,
  projectName,
  contentHash,
  paymentTxHash,
  registryTxHash,
}: {
  walletAddress?: string | null;
  projectName: string;
  contentHash: string;
  paymentTxHash?: string;
  registryTxHash?: string;
}) {
  if (process.env.SKIP_CHAIN_VERIFICATION === "true") return;
  if (!walletAddress) throw new Error("Wallet address is required for chain verification");
  if (!paymentTxHash || !registryTxHash) {
    throw new Error("Payment and registry transaction hashes are required");
  }

  const treasuryAddress = process.env.TREASURY_ADDRESS || process.env.VITE_TREASURY_ADDRESS || "";
  const registryAddress = process.env.REGISTRY_ADDRESS || process.env.VITE_REGISTRY_ADDRESS || "";
  const usdtCoinType = process.env.USDT_COIN_TYPE || process.env.VITE_USDT_COIN_TYPE || "";
  const deployFee = String(process.env.DEPLOY_FEE || "10000");
  if (!treasuryAddress || !registryAddress || !usdtCoinType) {
    throw new Error("Missing chain configuration for deployment verification");
  }

  const sender = normalizeAddress(walletAddress);
  const payment = await fetchTransaction(paymentTxHash);
  if (!payment.success) throw new Error("Deployment fee transaction failed");
  if (normalizeAddress(payment.sender || "") !== sender) {
    throw new Error("Deployment fee transaction sender does not match connected wallet");
  }
  if (payment.payload?.function !== "0x1::coin::transfer") {
    throw new Error("Deployment fee transaction did not call coin::transfer");
  }
  if (payment.payload.type_arguments?.[0] !== usdtCoinType) {
    throw new Error("Deployment fee transaction used the wrong coin type");
  }
  if (
    normalizeAddress(String(payment.payload.arguments?.[0] || "")) !==
    normalizeAddress(treasuryAddress)
  ) {
    throw new Error("Deployment fee transaction used the wrong treasury address");
  }
  if (String(payment.payload.arguments?.[1] || "") !== deployFee) {
    throw new Error("Deployment fee transaction used the wrong fee amount");
  }

  const registry = await fetchTransaction(registryTxHash);
  if (!registry.success) throw new Error("Registry transaction failed");
  if (normalizeAddress(registry.sender || "") !== sender) {
    throw new Error("Registry transaction sender does not match connected wallet");
  }
  if (registry.payload?.function !== `${registryAddress}::registry::register_project`) {
    throw new Error("Registry transaction called the wrong function");
  }
  if (String(registry.payload.arguments?.[0] || "") !== projectName) {
    throw new Error("Registry transaction project name does not match");
  }
  if (String(registry.payload.arguments?.[1] || "") !== contentHash) {
    throw new Error("Registry transaction content hash does not match");
  }
}

export { requireEnv };
