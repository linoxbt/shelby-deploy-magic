import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid2X2, List, Plus, Server, ShieldCheck, UploadCloud, Zap } from "lucide-react";
import { AppShell, formatBytes } from "../components/shelbyhost/AppShell";
import { ProjectCard } from "../components/shelbyhost/ProjectCard";
import { useShelbyHost } from "../context/ShelbyHostContext";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ShelbyHost" }, { name: "description", content: "Manage ShelbyHost projects, storage usage, deployments, and uptime." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { projects } = useShelbyHost();
  const totalSize = projects.reduce((sum, project) => sum + project.size, 0);
  const stats = [
    { label: "Total Projects", value: projects.length.toString(), icon: Server },
    { label: "Total Storage", value: formatBytes(totalSize), icon: UploadCloud },
    { label: "Deployments Today", value: "3", icon: Zap },
    { label: "Uptime", value: "99.98%", icon: ShieldCheck },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">ShelbyHost dashboard</p>
            <h1 className="mt-2 text-3xl font-extrabold text-foreground">Good morning, builder.</h1>
          </div>
          <Link to="/deploy" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover hover:shadow-glow">
            <Plus className="h-4 w-4" /> New Deployment
          </Link>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-4 font-mono text-3xl font-bold text-primary">{stat.value}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Projects</h2>
              <p className="mt-1 text-sm text-muted-foreground">Live frontends resolved by slug, hash, and optional custom domain.</p>
            </div>
            <div className="hidden rounded-md border border-border p-1 sm:flex">
              <button className="rounded bg-primary/10 p-2 text-primary" aria-label="Grid view"><Grid2X2 className="h-4 w-4" /></button>
              <button className="rounded p-2 text-muted-foreground" aria-label="List view"><List className="h-4 w-4" /></button>
            </div>
          </div>

          {projects.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 text-xl font-bold text-foreground">No deployments yet. Ship your first project.</h3>
              <Link to="/deploy" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Deploy Now</Link>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
