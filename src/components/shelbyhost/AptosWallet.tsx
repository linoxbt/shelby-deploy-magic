import { useEffect, useState, createContext, useContext } from "react";
import { ChevronDown, Wallet, LogOut, Copy, Check } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
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
  const { user, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();

  // Find the first Aptos wallet if available, otherwise fallback to Privy's embedded/linked wallets
  // For this implementation, we assume the user is using an Aptos wallet connected via Privy
  const aptosWallet = wallets.find(w => w.walletClientType === 'petra' || w.walletClientType === 'martian');
  const address = user?.aptos?.address || aptosWallet?.address;

  useEffect(() => {
    if (ready) {
      setCachedAddress(authenticated ? address : undefined);
      
      if (authenticated && aptosWallet) {
        // Mocking signAndSubmit since it depends on the specific wallet type in Privy
        // In a real implementation, we'd use the wallet's provider
        setCachedSignAndSubmit(async (tx: any) => {
          // This is a simplified version. Privy's wallets have a getProvider() method.
          const provider = await aptosWallet.getProvider();
          // Logic to sign and submit using the provider...
          return { hash: "0x..." }; 
        });
      }
    }
  }, [ready, authenticated, address, aptosWallet]);

  return <>{children}</>;
}

export function AptosWalletButton({ compact = false }: { compact?: boolean }) {
  const { login, logout, authenticated, user, ready } = usePrivy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const address = user?.aptos?.address || user?.wallet?.address;
  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!ready) return (
    <button disabled className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-bold text-muted-foreground opacity-50">
      <Wallet className="h-4 w-4" /> Loading...
    </button>
  );

  if (!authenticated) {
    return (
      <button 
        onClick={() => login()}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-glow transition hover:bg-primary-hover"
      >
        <Wallet className="h-4 w-4" />
        Connect with Privy
      </button>
    );
  }

  if (compact) {
    return (
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary">
        <div className="h-2 w-2 rounded-full bg-success shadow-glow" />
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
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Connected Wallet</p>
            <p className="text-sm font-mono font-bold text-foreground">{displayAddress}</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
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
            onClick={() => { logout(); setOpen(false); }}
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
