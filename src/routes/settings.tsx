import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Check, Copy, Github, KeyRound, Loader2, LogOut, ShieldAlert, User } from "lucide-react";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
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
  const { wallet, getWallet, linkGithub, disconnectGithub, fetchGithubRepos } = useShelbyHost();
  const { user, authenticated, ready, logout } = usePrivy();
  const navigate = useNavigate();
  const [privateKey, setPrivateKey] = useState("");
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

  const revealPrivateKey = async () => {
    const data = await getWallet(true);
    if (data?.privateKey) setPrivateKey(data.privateKey);
  };

  const copy = async (value: string, key: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  };

  const testGithub = async () => {
    await linkGithub();
    const repos = await fetchGithubRepos();
    setRepoCount(repos.length);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <p className="text-sm font-semibold text-primary">Workspace settings</p>
        <h1 className="mt-2 text-3xl font-extrabold text-foreground">Settings</h1>
        <section className="mt-8 space-y-5">
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
              Managed Aptos Address
              <input
                readOnly
                value={wallet?.address || "Creating account..."}
                className="rounded-md border border-input bg-background/50 px-3 py-3 font-mono text-muted-foreground outline-none"
              />
            </label>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-foreground">
              Public Key
              <input
                readOnly
                value={wallet?.publicKey || "Pending"}
                className="rounded-md border border-input bg-background/50 px-3 py-3 font-mono text-muted-foreground outline-none"
              />
            </label>
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-bold text-foreground">Private key export</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This key controls the generated Aptos account. Keep it offline and never share it.
                  </p>
                </div>
              </div>
              {privateKey ? (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background p-3">
                  <code className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {privateKey}
                  </code>
                  <button onClick={() => copy(privateKey, "private")} className="text-primary">
                    {copied === "private" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={revealPrivateKey}
                  className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Reveal private key
                </button>
              )}
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
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-5 flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
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
