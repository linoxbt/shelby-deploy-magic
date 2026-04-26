import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, ExternalLink, FileCode2, Trash2 } from "lucide-react";
import { AppShell, formatBytes, StatusBadge } from "../components/shelbyhost/AppShell";
import { useShelbyHost } from "../context/ShelbyHostContext";

export const Route = createFileRoute("/project/")({
  head: () => ({ meta: [{ title: "Project — ShelbyHost" }, { name: "description", content: "ShelbyHost project deployment details, file tree, hashes, and custom domain status." }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { projects, deleteProject } = useShelbyHost();
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-3xl font-bold text-foreground">Project not found</h1>
          <Link to="/dashboard" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Back to dashboard</Link>
        </div>
      </AppShell>
    );
  }

  const publicUrl = `shelbyhost.pages.dev/p/${project.slug}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-extrabold text-foreground">{project.name}</h1><StatusBadge status={project.status} /></div>
            <p className="mt-2 text-sm text-muted-foreground">Deployed {new Date(project.deployedAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-3"><a href={`https://${publicUrl}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><ExternalLink className="h-4 w-4" /> Visit Site</a><button onClick={() => { deleteProject(project.slug); navigate({ to: "/dashboard" }); }} className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2.5 text-sm font-bold text-destructive"><Trash2 className="h-4 w-4" /> Delete</button></div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">Deployment Info</h2>
            <InfoRow label="Public URL" value={publicUrl} />
            <InfoRow label="Content hash" value={project.hash} />
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Metric label="Files" value={project.files.length.toString()} />
              <Metric label="Total size" value={formatBytes(project.size)} />
            </div>
            <div className="mt-5 rounded-md border border-border bg-secondary p-4">
              <p className="text-sm font-semibold text-foreground">Custom domain routing</p>
              {project.domain ? <div className="mt-3 flex items-center justify-between gap-3"><span className="font-mono text-sm text-primary">{project.domain.domain}</span><StatusBadge status={project.domain.status} /></div> : <p className="mt-2 text-sm text-muted-foreground">No custom domain attached yet.</p>}
              <p className="mt-3 font-mono text-xs text-muted-foreground">CNAME → shelbyhost.pages.dev</p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">File Tree</h2>
            <div className="mt-4 overflow-hidden rounded-md border border-border">
              {project.files.map((file) => <div key={file.path} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-background/40 px-4 py-3 last:border-b-0"><span className="flex min-w-0 items-center gap-2 truncate font-mono text-sm text-foreground"><FileCode2 className="h-4 w-4 text-primary" />{file.path}</span><span className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</span><span className="font-mono text-xs text-muted-foreground">{file.type}</span></div>)}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground">Activity Log</h2>
          <div className="mt-5 space-y-4 border-l border-primary/40 pl-5">
            {["Deployed", `${project.files.length} files uploaded · ${formatBytes(project.size)}`, "Content hash registered on Aptos", project.domain ? `Domain ${project.domain.domain} mapped in KV` : "Shelby URL assigned"].map((item) => <p key={item} className="relative text-sm text-muted-foreground before:absolute before:-left-[25px] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-primary"><span className="font-semibold text-foreground">✓ {item}</span> · {new Date(project.deployedAt).toLocaleString()}</p>)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-4 rounded-md border border-border bg-background/50 p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><div className="mt-2 flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-mono text-sm text-primary">{value}</p><Copy className="h-4 w-4 text-muted-foreground" /></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background/50 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-bold text-primary">{value}</p></div>;
}
