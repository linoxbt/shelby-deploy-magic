import { AptosWalletButton } from "../components/shelbyhost/AptosWallet";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Github, Loader2, LogOut, ShieldAlert, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/shelbyhost/AppShell";
import { useShelbyHost } from "../context/ShelbyHostContext";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ShelbyHost" },
      {
        name: "description",
        content: "Configure ShelbyHost profile, notifications, and account safety settings.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { wallet, linkGithub, disconnectGithub, fetchGithubRepos } = useShelbyHost();
  const { user, authenticated, ready, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState("");
  const [repoCount, setRepoCount] = useState<number | null>(null);

  useEffect(() => {
    if (ready && !authenticated) {
      navigate({ to: "/" });
    }
  }, [ready, authenticated, navigate]);

  if (!ready) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!authenticated) return null;

  const testGithub = async () => {
    await linkGithub();
    const repos = await fetchGithubRepos();
    setRepoCount(repos.length);
  };

  return (
    <AppShell>
      <div className="console-page settings-page">
        <p className="console-eyebrow">Workspace</p>
        <h1 className="console-title">
          Settings that keep you <em>in control.</em>
        </h1>
        <p className="console-subtitle">
          Manage identity, source access, deployment notifications, and workspace security.
        </p>
        <section className="settings-grid">
          <Panel icon={User} title="Profile">
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Account
              <input
                readOnly
                value={user?.email?.address || user?.id || "Shelby builder"}
                className="rounded-md border border-input bg-background/50 px-3 py-3 text-muted-foreground outline-none"
              />
            </label>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-foreground">
              Connected Aptos Address
              <input
                readOnly
                value={wallet?.address || "Connect an Aptos wallet"}
                className="rounded-md border border-input bg-background/50 px-3 py-3 font-mono text-muted-foreground outline-none"
              />
            </label>
            <div className="mt-4">
              <AptosWalletButton />
              <p className="mt-2 text-sm text-muted-foreground">
                Your wallet approves Aptos transactions. ShelbyHost never receives its private key.
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </Panel>
          <Panel icon={Github} title="GitHub">
            <p className="text-sm text-muted-foreground">
              Authorize GitHub repository access to import repos and install ShelbyHost Actions.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={testGithub}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Connect GitHub
              </button>
              <button
                onClick={disconnectGithub}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-bold text-foreground"
              >
                Disconnect GitHub
              </button>
            </div>
            {repoCount !== null && (
              <p className="mt-3 text-sm font-semibold text-primary">
                {repoCount} repositories available for import.
              </p>
            )}
          </Panel>
          <Panel icon={Bell} title="Notifications">
            <Toggle label="Email on deploy success" defaultChecked />
            <Toggle label="Email on storage warnings" />
          </Panel>
          <Panel icon={ShieldAlert} title="Danger Zone">
            <p className="text-sm text-muted-foreground">
              Delete local project history and workspace preferences from this browser.
            </p>
            <button className="mt-4 rounded-md border border-destructive/50 px-4 py-2.5 text-sm font-bold text-destructive transition hover:bg-destructive/10">
              Delete Account
            </button>
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-panel console-panel">
      <div className="settings-panel-title">
        <span>
          <Icon size={17} />
        </span>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between border-b border-border py-4 last:border-b-0">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="h-5 w-5 accent-primary" />
    </label>
  );
}
