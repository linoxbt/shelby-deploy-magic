import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { ensureManagedAptosWallet, decryptWalletSecret } from "../../api/_lib/wallet";
import type { getSupabaseAdmin } from "../../api/_lib/supabase";
export async function registerRelease(
  db: ReturnType<typeof getSupabaseAdmin>,
  project: any,
  hash: string,
  record: (patch: Record<string, string>) => Promise<void>,
) {
  const wallet = await ensureManagedAptosWallet(db, project.owner_id);
  if (!wallet.private_key_encrypted) throw new Error("Managed signing wallet is unavailable");
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(decryptWalletSecret(wallet.private_key_encrypted)),
  });
  const network = process.env.APTOS_NETWORK === "mainnet" ? Network.MAINNET : Network.TESTNET;
  const aptos = new Aptos(
    new AptosConfig({
      network,
      fullnode: process.env.APTOS_FULLNODE_URL,
      clientConfig: { API_KEY: process.env.APTOS_API_KEY },
    }),
  );
  const registry = process.env.REGISTRY_ADDRESS || process.env.VITE_REGISTRY_ADDRESS;
  if (!registry) throw new Error("REGISTRY_ADDRESS is required for publishing");
  let feeHash = project.payment_tx_hash;
  if (!feeHash) {
    const treasury = process.env.TREASURY_ADDRESS || process.env.VITE_TREASURY_ADDRESS,
      coin = process.env.USDT_COIN_TYPE || process.env.VITE_USDT_COIN_TYPE;
    if (!treasury || !coin) throw new Error("Treasury and fee token configuration are required");
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: "0x1::coin::transfer",
        typeArguments: [coin],
        functionArguments: [treasury, process.env.DEPLOY_FEE || "10000"],
      },
    });
    const sent = await aptos.signAndSubmitTransaction({ signer: account, transaction });
    feeHash = sent.hash;
    // Persist a broadcast receipt before awaiting confirmation, so a failed
    // job's redeploy checks this transaction instead of charging again.
    const { error } = await db
      .from("shelby_projects")
      .update({ payment_tx_hash: feeHash, wallet_address: wallet.address })
      .eq("id", project.id);
    if (error) throw error;
  }
  await record({ payment_tx_hash: feeHash });
  const payment = await aptos.waitForTransaction({
    transactionHash: feeHash,
    options: { checkSuccess: false },
  });
  if (!payment.success) {
    await db
      .from("shelby_projects")
      .update({ payment_tx_hash: null })
      .eq("id", project.id)
      .eq("payment_tx_hash", feeHash);
    throw new Error(
      "Deployment fee transaction failed on-chain; fund the managed wallet and redeploy",
    );
  }
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${registry}::registry::register_project`,
      functionArguments: [project.name, hash],
    },
  });
  const sent = await aptos.signAndSubmitTransaction({ signer: account, transaction });
  await record({ registry_tx_hash: sent.hash });
  const registered = await aptos.waitForTransaction({
    transactionHash: sent.hash,
    options: { checkSuccess: true },
  });
  if (!registered.success) throw new Error("Registry transaction failed");
  return sent.hash;
}
