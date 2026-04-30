import { useEffect, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";

type AptosClientModule = typeof import("./AptosWalletClient");

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
  const [Provider, setProvider] = useState<AptosClientModule["AptosProviderClient"] | null>(null);

  useEffect(() => {
    let mounted = true;
    import("./AptosWalletClient").then((module) => {
      if (mounted) setProvider(() => module.AptosProviderClient);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!Provider) return <>{children}</>;
  return <Provider>{children}</Provider>;
}

export function AptosWalletButton({ compact = false }: { compact?: boolean }) {
  const [Button, setButton] = useState<AptosClientModule["AptosWalletButtonClient"] | null>(null);

  useEffect(() => {
    let mounted = true;
    import("./AptosWalletClient").then((module) => {
      if (mounted) setButton(() => module.AptosWalletButtonClient);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (Button) return <Button compact={compact} />;

  return (
    <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-bold text-foreground shadow-panel">
      <Wallet className="h-4 w-4 text-primary" />
      Connect Wallet
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}