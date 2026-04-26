import { Link, useLocation } from "@tanstack/react-router";
import { Cloud, FolderGit2, Gauge, LayoutDashboard, Settings, UploadCloud } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard", label: "Projects", icon: Gauge },
  { to: "/deploy", label: "Deploy", icon: UploadCloud },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function LogoMark() {
  return (
    <Link to="/" className="group flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary transition group-hover:shadow-glow">
        <Cloud className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-success" />
      </span>
      <span className="text-lg font-extrabold tracking-normal text-foreground">shelbyhost</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-grid opacity-70" />
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-60 border-r border-border bg-sidebar/95 px-4 py-5 backdrop-blur lg:block">
        <LogoMark />
        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || (item.label === "Projects" && location.pathname.startsWith("/project"));
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
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
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Builder wallet</p>
              <p className="truncate font-mono text-xs text-muted-foreground">0x1a2b...3c4d</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="pb-20 lg:pl-60 lg:pb-0">{children}</main>
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

export function StatusBadge({ status }: { status: "live" | "processing" | "failed" | "verified" | "pending" }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${status === "live" || status === "verified" ? "border-success/30 bg-success/10 text-success" : status === "failed" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/10 text-warning"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
