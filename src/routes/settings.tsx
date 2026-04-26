import { createFileRoute } from "@tanstack/react-router";
import { Bell, ShieldAlert, User } from "lucide-react";
import { AppShell } from "../components/shelbyhost/AppShell";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — ShelbyHost" }, { name: "description", content: "Configure ShelbyHost profile, notifications, and account safety settings." }] }),
  component: Settings,
});

function Settings() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <p className="text-sm font-semibold text-primary">Workspace settings</p>
        <h1 className="mt-2 text-3xl font-extrabold text-foreground">Settings</h1>
        <section className="mt-8 space-y-5">
          <Panel icon={User} title="Profile">
            <label className="grid gap-2 text-sm font-semibold text-foreground">Display name<input defaultValue="Shelby builder" className="rounded-md border border-input bg-background px-3 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring" /></label>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-foreground">Wallet address<input readOnly value="0x1a2b...3c4d" className="rounded-md border border-input bg-background px-3 py-3 font-mono text-muted-foreground outline-none" /></label>
          </Panel>
          <Panel icon={Bell} title="Notifications">
            <Toggle label="Email on deploy success" defaultChecked />
            <Toggle label="Email on storage warnings" />
          </Panel>
          <Panel icon={ShieldAlert} title="Danger Zone">
            <p className="text-sm text-muted-foreground">Delete local project history and workspace preferences from this browser.</p>
            <button className="mt-4 rounded-md border border-destructive/50 px-4 py-2.5 text-sm font-bold text-destructive transition hover:bg-destructive/10">Delete Account</button>
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}

function Panel({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5"><div className="mb-5 flex items-center gap-3"><Icon className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold text-foreground">{title}</h2></div>{children}</div>;
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return <label className="flex items-center justify-between border-b border-border py-4 last:border-b-0"><span className="text-sm font-semibold text-foreground">{label}</span><input type="checkbox" defaultChecked={defaultChecked} className="h-5 w-5 accent-primary" /></label>;
}
