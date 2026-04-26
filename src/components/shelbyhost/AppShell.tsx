import { Link, useLocation } from "@tanstack/react-router";
import { FolderGit2, Gauge, LayoutDashboard, Settings, UploadCloud } from "lucide-react";
import { AptosWalletButton } from "./AptosWallet";
import { useShelbyHost } from "../../context/ShelbyHostContext";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard", label: "Projects", icon: Gauge },
  { to: "/deploy", label: "Deploy", icon: UploadCloud },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function ShelbyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="relative grid h-9 w-9 place-items-center rounded-md border border-primary/50 bg-primary/10 shadow-glow">
        <span className="absolute inset-1 rounded-sm border border-primary/70" />
        <span className="h-3 w-3 rotate-45 border-2 border-primary bg-background" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-lg font-black tracking-normal text-foreground">Shelby Host</span>
        </span>
      )}
    </span>
  );
}

export function LogoMark() {
  return (
    <Link to="/" className="group flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
      <ShelbyLogo />
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { wallet, connectWallet } = useShelbyHost();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-grid opacity-90" />
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 border-r border-border bg-sidebar/95 px-4 py-5 backdrop-blur lg:block">
        <LogoMark />
        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || (item.label === "Projects" && location.pathname.startsWith("/project"));
            return (
              <Link key={item.label} to={item.to} className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition ${active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-md border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderGit2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{wallet ? `${wallet.chain.toUpperCase()} wallet` : "Builder wallet"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{wallet?.address ?? "Not connected"}</p>
            </div>
          </div>
          {!wallet && <button onClick={() => connectWallet("aptos")} className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground transition hover:bg-primary-hover">Connect Aptos</button>}
        </div>
      </aside>
      <main className="pb-20 lg:pl-64 lg:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/85 px-5 py-3 backdrop-blur lg:hidden">
          <LogoMark />
          <AptosWalletButton compact />
        </header>
        <div className="hidden justify-end border-b border-border bg-background/70 px-8 py-3 backdrop-blur lg:flex">
          <AptosWalletButton />
        </div>
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-border bg-sidebar/95 px-2 py-2 backdrop-blur lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (
            <Link key={item.label} to={item.to} className={`flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function StatusBadge({ status }: { status: "live" | "processing" | "failed" | "verified" | "pending" | "queued" | "succeeded" }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${status === "live" || status === "verified" || status === "succeeded" ? "border-success/30 bg-success/10 text-success" : status === "failed" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/10 text-warning"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
