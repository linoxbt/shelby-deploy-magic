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

  // Find the first Aptos wallet if available
  const aptosWallet = wallets.find(w => 
    w.walletClientType === 'petra' || 
    w.walletClientType === 'martian' ||
    w.walletClientType.toLowerCase().includes('aptos')
  );
  
  // Use Privy's linked Aptos address, or the detected wallet address, or fallback to window.aptos if available
  const [injectedAddress, setInjectedAddress] = useState<string | undefined>();

  useEffect(() => {
    const checkInjected = async () => {
      // @ts-ignore
      if (window.aptos) {
        try {
          // @ts-ignore
          const account = await window.aptos.account();
          if (account?.address) setInjectedAddress(account.address);
        } catch (e) {
          // Might not be connected yet
        }
      }
    };
    checkInjected();
  }, []);

  const address = user?.aptos?.address || aptosWallet?.address || injectedAddress;

  useEffect(() => {
    if (ready) {
      setCachedAddress(authenticated || !!injectedAddress ? address : undefined);
      
      if (aptosWallet) {
        setCachedSignAndSubmit(async (tx: any) => {
          const provider = await aptosWallet.getProvider();
          // Logic for signing...
          return { hash: "0x..." }; 
        });
      } else if (injectedAddress) {
        setCachedSignAndSubmit(async (tx: any) => {
          // @ts-ignore
          if (window.aptos) {
            // @ts-ignore
            return await window.aptos.signAndSubmitTransaction(tx);
          }
          throw new Error("Aptos wallet not found");
        });
      }
    }
  }, [ready, authenticated, address, aptosWallet, injectedAddress]);

  return <>{children}</>;
}

export function AptosWalletButton({ compact = false }: { compact?: boolean }) {
  const { login, logout, authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [injectedAddress, setInjectedAddress] = useState<string | undefined>();

  useEffect(() => {
    const checkInjected = async () => {
      // @ts-ignore
      if (window.aptos) {
        try {
          // @ts-ignore
          const account = await window.aptos.account();
          if (account?.address) setInjectedAddress(account.address);
        } catch (e) {}
      }
    };
    checkInjected();
  }, []);
  
  const aptosWallet = wallets.find(w => w.walletClientType.toLowerCase().includes('aptos'));
  const address = user?.aptos?.address || aptosWallet?.address || injectedAddress;
  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const handleConnect = async () => {
    // If we detect window.aptos but Privy hasn't linked it, we can try to use it directly
    // @ts-ignore
    if (window.aptos && !authenticated) {
      try {
        // @ts-ignore
        const account = await window.aptos.connect();
        if (account?.address) {
          setInjectedAddress(account.address);
          setCachedAddress(account.address);
          toast.success("Aptos wallet connected via extension");
          return;
        }
      } catch (e) {
        console.error("Injected connect error:", e);
      }
    }
    login();
  };

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    if (authenticated) {
      logout();
    }
    setInjectedAddress(undefined);
    setCachedAddress(undefined);
    setOpen(false);
  };

  if (!ready) return (
    <button disabled className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-bold text-muted-foreground opacity-50">
      <Wallet className="h-4 w-4" /> Loading...
    </button>
  );

  if (!authenticated && !injectedAddress) {
    return (
      <button 
        onClick={handleConnect}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-glow transition hover:bg-primary-hover"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
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
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Connected {injectedAddress && !authenticated ? "Extension" : "Privy"}</p>
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
