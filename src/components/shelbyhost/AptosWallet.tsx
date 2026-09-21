import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isAptosWallet } from "@dynamic-labs/aptos";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Wallet, Copy, LogOut } from "lucide-react";
import { dynamicConfigured, useAuth } from "../../lib/auth";
import { toast } from "sonner";
import type { InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";
type AptosSession = {
  address?: string;
  signAndSubmit: (data: InputGenerateTransactionPayloadData, network: string) => Promise<string>;
  connect: () => void;
};
const Context = createContext<AptosSession>({
  signAndSubmit: async () => {
    throw Error("Connect an Aptos wallet");
  },
  connect: () => {},
});
let cachedSignAndSubmit: ((tx: any) => Promise<any>) | undefined;
export const getAptosSignAndSubmit = () => cachedSignAndSubmit;
export const useAptosSession = () => useContext(Context);
export const useAptosAddress = () => useAptosSession().address;
function ConnectedProvider({ children }: { children: React.ReactNode }) {
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const wallet = primaryWallet && isAptosWallet(primaryWallet) ? primaryWallet : undefined;
  const signAndSubmit = useCallback(
    async (data: InputGenerateTransactionPayloadData, network: string) => {
      if (!wallet) throw Error("Connect and authenticate an Aptos wallet");
      const info = await wallet.getNetworkInfo();
      if (info?.name?.toLowerCase() !== network.toLowerCase())
        throw Error(`Switch your Aptos wallet to ${network} before signing`);
      return wallet.signAndSubmitTransaction(
        data as Parameters<typeof wallet.signAndSubmitTransaction>[0],
      );
    },
    [wallet],
  );
  useEffect(() => {
    cachedSignAndSubmit = wallet
      ? async (tx: any) => ({
          hash: await signAndSubmit(tx.data ?? tx, import.meta.env.VITE_APTOS_NETWORK || "testnet"),
        })
      : undefined;
    return () => {
      cachedSignAndSubmit = undefined;
    };
  }, [signAndSubmit, wallet]);
  return (
    <Context.Provider
      value={{ address: wallet?.address, signAndSubmit, connect: () => setShowAuthFlow(true) }}
    >
      {children}
    </Context.Provider>
  );
}
export function AptosProvider({ children }: { children: React.ReactNode }) {
  return dynamicConfigured ? <ConnectedProvider>{children}</ConnectedProvider> : <>{children}</>;
}
export function AptosWalletButton({ compact = false }: { compact?: boolean }) {
  const { address, connect } = useAptosSession(),
    { logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => (address ? setOpen(!open) : connect())}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-bold"
      >
        <Wallet size={16} />
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect Aptos wallet"}
      </button>
      {open && address && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded border border-border bg-card p-2 shadow-xl">
          <p className="px-2 py-1 text-xs text-muted-foreground">Connected through Dynamic</p>
          <button
            className="flex items-center gap-2 p-2 text-sm"
            onClick={() =>
              navigator.clipboard.writeText(address).then(() => toast.success("Address copied"))
            }
          >
            <Copy size={14} />
            Copy address
          </button>
          <button className="flex items-center gap-2 p-2 text-sm" onClick={() => logout()}>
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
