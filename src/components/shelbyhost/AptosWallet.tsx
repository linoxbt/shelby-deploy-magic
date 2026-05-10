import { useEffect, useState } from "react";
import { ChevronDown, Wallet, LogOut, Copy, Check } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { toast } from "sonner";

// Privy uses EVM by default but supports Aptos.
// We'll map the Privy state to our ShelbyHost logic.

let cachedAddress: string | undefined = undefined;
const listeners = new Set<(addr: string | undefined) => void>();

export function setCachedAddress(address: string | undefined) {
  if (cachedAddress !== address) {
    cachedAddress = address;
    listeners.forEach((l) => l(address));
  }
}

let cachedSignAndSubmit: ((tx: any) => Promise<any>) | undefined = undefined;

export function setCachedSignAndSubmit(fn: ((tx: any) => Promise<any>) | undefined) {
  cachedSignAndSubmit = fn;
}

export function getAptosSignAndSubmit() {
  return cachedSignAndSubmit;
}

export function useAptosAddress() {
  const [address, setAddress] = useState<string | undefined>(cachedAddress);
  useEffect(() => {
    listeners.add(setAddress);
    return () => {
      listeners.delete(setAddress);
    };
  }, []);
  return address;
}

export function AptosProvider({ children }: { children: React.ReactNode }) {
  const { account, connected, network, signAndSubmitTransaction } = useWallet();
  const address = account?.address?.toString();

  // Enforce testnet end-to-end. If the user is connected to a different
  // network, warn them and treat the wallet as unusable for deploys.
  useEffect(() => {
    if (!connected || !network) return;
    const name = (network.name || "").toLowerCase();
    if (name && name !== Network.TESTNET) {
      toast.error(
        `ShelbyHost runs on Aptos Testnet. Please switch your wallet from ${network.name} to Testnet.`,
      );
    }
  }, [connected, network]);

  useEffect(() => {
    const onTestnet =
      !network || (network.name || "").toLowerCase() === Network.TESTNET;
    setCachedAddress(connected && address && onTestnet ? address : undefined);

    if (connected && onTestnet) {
      setCachedSignAndSubmit(async (tx: any) => {
        const payload = tx?.data ?? tx;
        const result = await signAndSubmitTransaction({
          data: payload,
        } as any);
        if (!(result as any)?.hash) {
          throw new Error("Transaction failed: no hash returned from wallet.");
        }
        return result;
      });
    } else {
      setCachedSignAndSubmit(undefined);
    }
  }, [connected, address, network, signAndSubmitTransaction]);

  return <>{children}</>;
}

export function AptosWalletButton({ compact = false }: { compact?: boolean }) {
  const { connect, disconnect, connected, account, wallets, network } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const address = account?.address?.toString();
  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const onTestnet =
    !network || (network.name || "").toLowerCase() === Network.TESTNET;

  const handleConnect = async () => {
    try {
      const petra = wallets?.find((w) => (w.name || "").toLowerCase() === "petra");
      if (!petra) {
        toast.error("Petra wallet not detected. Install it from petra.app");
        return;
      }
      await connect(petra.name);
      toast.success("Connected to Petra (Aptos Testnet)");
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect Petra");
    }
  };

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch {
      /* ignore */
    }
    setCachedAddress(undefined);
    setOpen(false);
  };

  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-glow transition hover:bg-primary-hover"
      >
        <Wallet className="h-4 w-4" />
        Connect Petra
      </button>
    );
  }

  if (compact) {
    return (
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary"
      >
        <div
          className={`h-2 w-2 rounded-full shadow-glow ${onTestnet ? "bg-success" : "bg-destructive"}`}
        />
        {displayAddress}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-card p-3 transition hover:border-primary"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {onTestnet ? "Aptos Testnet" : `Wrong Network: ${network?.name}`}
            </p>
            <p className="text-sm font-mono font-bold text-foreground">{displayAddress}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-full min-w-[200px] rounded-lg border border-border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
          <button
            onClick={copyAddress}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-muted-foreground" />
              Copy Address
            </div>
            {copied && <Check className="h-4 w-4 text-success" />}
          </button>
          <button
            onClick={handleDisconnect}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
