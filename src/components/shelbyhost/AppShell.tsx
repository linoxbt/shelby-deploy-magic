import { Link, useLocation } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useShelbyHost } from "../../context/ShelbyHostContext";
import { AptosWalletButton } from "./AptosWallet";
import "../../console.css";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/deploy", label: "New deployment", icon: UploadCloud },
  { to: "/settings", label: "Workspace settings", icon: Settings },
  { to: "/grant", label: "Platform brief", icon: FileText },
] as const;

export function ShelbyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="console-logo">
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="m18 2 15 9v16l-15 9L3 27V11L18 2Z" fill="currentColor" />
        <path
          d="m11 12 7-4 7 4-7 4-7-4Zm0 6 7 4 7-4m-14 6 7 4 7-4"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span>
          shelby<span>host</span>
          <b>.</b>
        </span>
      )}
    </span>
  );
}

export function LogoMark() {
  return (
    <Link to="/" className="console-logo-link" aria-label="ShelbyHost home">
      <ShelbyLogo />
    </Link>
  );
}

function currentLabel(pathname: string) {
  if (pathname.startsWith("/project/")) return "Project workspace";
  return navItems.find((item) => item.to === pathname)?.label || "Console";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { wallet, projects } = useShelbyHost();
  return (
    <div className="app-shell min-h-screen text-foreground">
      <aside className="console-sidebar">
        <div className="sidebar-top">
          <LogoMark />
          <span className="console-badge">Console</span>
        </div>
        <Link to="/deploy" className="sidebar-create">
          <Plus size={16} /> Create project <ChevronRight size={14} />
        </Link>
        <p className="sidebar-label">Workspace</p>
        <nav className="console-nav" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.to ||
              (item.to === "/dashboard" && location.pathname.startsWith("/project"));
            return (
              <Link key={item.label} to={item.to} data-active={active || undefined}>
                <span>
                  <Icon size={17} />
                </span>
                {item.label}
                {item.to === "/dashboard" && projects.length > 0 && (
                  <small>{projects.length}</small>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-guide">
          <span className="guide-icon">
            <Sparkles size={15} />
          </span>
          <strong>Deploy with confidence</strong>
          <p>Every release is built in isolation, verified, and stored on Shelby.</p>
          <Link to="/docs" search={{ topic: "quickstart" }}>
            <BookOpen size={13} /> Read the guide
          </Link>
        </div>
        <div className="sidebar-account">
          <span className="account-identicon">{wallet?.address?.slice(2, 4) || "SH"}</span>
          <div>
            <strong>{wallet ? "Aptos connected" : "Wallet required"}</strong>
            <span>
              {wallet?.address
                ? `${wallet.address.slice(0, 7)}…${wallet.address.slice(-5)}`
                : "Connect to publish"}
            </span>
          </div>
          <Link to="/settings" aria-label="Account settings">
            <Settings size={15} />
          </Link>
        </div>
      </aside>
      <main className="console-main">
        <header className="console-topbar">
          <div className="mobile-logo">
            <LogoMark />
          </div>
          <div className="topbar-path">
            <span>ShelbyHost</span>
            <ChevronRight size={13} />
            <strong>{currentLabel(location.pathname)}</strong>
          </div>
          <div className="topbar-actions">
            <span className="network-pill">
              <i /> Aptos testnet
            </span>
            <Link
              to="/docs"
              search={{ topic: "quickstart" }}
              className="help-button"
              aria-label="Documentation"
            >
              <CircleHelp size={17} />
            </Link>
            <AptosWalletButton compact />
          </div>
        </header>
        <div className="console-content">{children}</div>
      </main>
      <nav className="console-mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.to ||
            (item.to === "/dashboard" && location.pathname.startsWith("/project"));
          return (
            <Link key={item.label} to={item.to} data-active={active || undefined}>
              <Icon size={18} />
              <span>{item.label.replace("Workspace ", "")}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status:
    | "live"
    | "processing"
    | "running"
    | "ready"
    | "failed"
    | "verified"
    | "pending"
    | "queued"
    | "succeeded";
}) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const good = ["live", "ready", "verified", "succeeded"].includes(status);
  return (
    <span
      className={`status-badge ${good ? "is-good" : status === "failed" ? "is-bad" : "is-waiting"}`}
    >
      <i />
      {label}
    </span>
  );
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
