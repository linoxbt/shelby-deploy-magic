import { useMemo, useState } from "react";
import { AptosWalletAdapterProvider, useWallet } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { Check, ChevronDown, Copy, ExternalLink, LogOut, Wallet } from "lucide-react";

const supportedWallets = [
  { name: "Petra", url: "https://petra.app/" },
  { name: "Martian", url: "https://martianwallet.xyz/" },
  { name: "Fewcha", url: "https://fewcha.app/" },
];

export function AptosProvider({ children }: { children: React.ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect
      optInWallets={["Petra"]}
      dappConfig={{ network: Network.TESTNET }}
      disableTelemetry
      onError={(error) => console.warn("Aptos wallet error", error)}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}

function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AptosWalletButton({ compact = false }: { compact?: boolean }) {
  const { account, changeNetwork, connect, connected, disconnect, network, notDetectedWallets, wallet, wallets } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const address = account?.address?.toString();
  const detectedNames = useMemo(() => new Set(wallets.map((item) => item.name.toLowerCase())), [wallets]);
  const installOptions = supportedWallets.filter((item) => !detectedNames.has(item.name.toLowerCase()));
  const detectedSupported = wallets.filter((item) => supportedWallets.some((supported) => supported.name.toLowerCase() === item.name.toLowerCase()));

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const switchNetwork = async (nextNetwork: Network) => {
    if (!connected) return;
    await changeNetwork(nextNetwork);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-bold text-foreground shadow-panel transition hover:border-primary/60 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        <Wallet className="h-4 w-4 text-primary" />
        {connected && address ? (compact ? shortAddress(address) : `${wallet?.name ?? "Aptos"} ${shortAddress(address)}`) : "Connect Wallet"}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-panel">
          {connected && address ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Connected wallet</p>
                <p className="mt-1 text-sm font-bold text-foreground">{wallet?.name ?? "Aptos wallet"}</p>
                <p className="mt-1 break-all font-mono text-xs text-primary">{address}</p>
                <p className="mt-1 text-xs text-muted-foreground">Network: {network?.name ?? "Aptos"}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => switchNetwork(Network.TESTNET)} className="rounded-md border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary">Testnet</button>
                <button onClick={() => switchNetwork(Network.MAINNET)} className="rounded-md border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary">Mainnet</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copyAddress} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground transition hover:bg-primary-hover">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
                <button onClick={() => disconnect()} className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs font-extrabold text-destructive transition hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-foreground">Choose an Aptos wallet</p>
                <p className="mt-1 text-xs text-muted-foreground">ShelbyHost is ready for Aptos testnet and mainnet.</p>
              </div>
              <div className="space-y-2">
                {detectedSupported.map((item) => (
                  <button key={item.name} onClick={() => connect(item.name)} className="flex w-full items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary">
                    <span>{item.name}</span><span className="text-xs text-success">Installed</span>
                  </button>
                ))}
                {detectedSupported.length === 0 && <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">No supported Aptos wallet detected.</p>}
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                {(notDetectedWallets.length ? installOptions : supportedWallets).map((item) => (
                  <a key={item.name} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-primary hover:text-primary">
                    Install {item.name}<ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}