import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, ExternalLink, FileCode2, GitBranch, Globe2, RefreshCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell, formatBytes, StatusBadge } from "../components/shelbyhost/AppShell";
import { useShelbyHost } from "../context/ShelbyHostContext";

export const Route = createFileRoute("/project/$slug")({
  head: () => ({ meta: [{ title: "Project — ShelbyHost" }, { name: "description", content: "ShelbyHost project deployment details, file tree, hashes, and custom domain status." }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { projects, deleteProject, updateProject, registerDomain, connectGithub, triggerGithubDeploy } = useShelbyHost();
  const project = projects.find((item) => item.slug === slug);
  const [framework, setFramework] = useState(project?.framework ?? "vite");
  const [buildOutput, setBuildOutput] = useState(project?.buildOutput ?? "dist");
  const [domain, setDomain] = useState(project?.domain?.domain ?? "");
  const [repo, setRepo] = useState(project?.github?.repository ?? "shelby-frontend");
  const [branch, setBranch] = useState(project?.github?.branch ?? "main");

  if (!project) {
    return <AppShell><div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-3xl font-bold text-foreground">Project not found</h1><Link to="/dashboard" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Back to dashboard</Link></div></AppShell>;
  }

  const publicUrl = `shelbyhost.pages.dev/p/${project.slug}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-extrabold text-foreground">{project.name}</h1><StatusBadge status={project.status} /></div><p className="mt-2 text-sm text-muted-foreground">Deployed {new Date(project.deployedAt).toLocaleString()} · {project.chain.toUpperCase()}</p></div>
          <div className="flex flex-wrap gap-3"><a href={`https://${publicUrl}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><ExternalLink className="h-4 w-4" /> Visit Site</a><button onClick={() => { deleteProject(project.slug); navigate({ to: "/dashboard" }); }} className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2.5 text-sm font-bold text-destructive"><Trash2 className="h-4 w-4" /> Delete</button></div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-border bg-card p-5"><h2 className="text-lg font-bold text-foreground">Deployment Info</h2><InfoRow label="Public URL" value={publicUrl} /><InfoRow label="Content hash" value={project.hash} /><InfoRow label="Latest version" value={project.latestVersionUrl} /><div className="mt-5 grid grid-cols-2 gap-4"><Metric label="Files" value={project.files.length.toString()} /><Metric label="Total size" value={formatBytes(project.size)} /></div></section>
          <section className="rounded-lg border border-border bg-card p-5"><h2 className="text-lg font-bold text-foreground">File Tree</h2><div className="mt-4 overflow-hidden rounded-md border border-border">{project.files.map((file) => <div key={file.path} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-background/40 px-4 py-3 last:border-b-0"><span className="flex min-w-0 items-center gap-2 truncate font-mono text-sm text-foreground"><FileCode2 className="h-4 w-4 text-primary" />{file.path}</span><span className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</span><span className="font-mono text-xs text-muted-foreground">{file.type}</span></div>)}</div></section>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Project settings" icon={RefreshCcw}><label className="grid gap-2 text-sm font-semibold text-foreground">Framework<input value={framework} onChange={(event) => setFramework(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary" /></label><label className="mt-3 grid gap-2 text-sm font-semibold text-foreground">Build output<input value={buildOutput} onChange={(event) => setBuildOutput(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary" /></label><button onClick={() => updateProject(project.slug, { framework, buildOutput }, "settings")} className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Save & redeploy</button></Panel>
          <Panel title="Custom domain KV" icon={Globe2}><label className="grid gap-2 text-sm font-semibold text-foreground">Domain<input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="myproject.com" className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary" /></label><button onClick={() => registerDomain(project.slug, domain)} className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Register domain</button>{project.domain && <div className="mt-4 rounded-md border border-border bg-secondary p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-primary">{project.domain.kvKey}</span><StatusBadge status={project.domain.status} /></div><p className="mt-2 font-mono text-xs text-muted-foreground">Host → {project.domain.slug} / {project.domain.hash.slice(0, 8)}</p></div>}</Panel>
          <Panel title="GitHub auto-deploy" icon={GitBranch}><label className="grid gap-2 text-sm font-semibold text-foreground">Repository<input value={repo} onChange={(event) => setRepo(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary" /></label><label className="mt-3 grid gap-2 text-sm font-semibold text-foreground">Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary" /></label><div className="mt-4 grid gap-2"><button onClick={() => connectGithub(project.slug, { account: "shelby-labs", repository: repo, branch })} className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Connect OAuth</button><button onClick={() => triggerGithubDeploy(project.slug)} className="rounded-md border border-border px-4 py-2.5 text-sm font-bold text-foreground">Trigger push</button></div>{project.github && <p className="mt-3 font-mono text-xs text-muted-foreground">{project.github.workflowFile}</p>}</Panel>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-5"><h2 className="text-lg font-bold text-foreground">Deployments history</h2><div className="mt-5 space-y-3">{project.deployments.map((deployment) => <div key={deployment.id} className="grid gap-3 rounded-md border border-border bg-background/40 p-3 sm:grid-cols-[1fr_auto_auto]"><div><p className="text-sm font-bold text-foreground">{deployment.message}</p><p className="font-mono text-xs text-muted-foreground">{new Date(deployment.timestamp).toLocaleString()} · {deployment.trigger}</p></div><StatusBadge status={deployment.status} /><a href={deployment.versionUrl} className="font-mono text-xs font-bold text-primary">latest</a></div>)}</div></section>
      </div>
    </AppShell>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof RefreshCcw; children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex items-center gap-3"><Icon className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold text-foreground">{title}</h2></div>{children}</div>;
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-4 rounded-md border border-border bg-background/50 p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><div className="mt-2 flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-mono text-sm text-primary">{value}</p><Copy className="h-4 w-4 text-muted-foreground" /></div></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background/50 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-bold text-primary">{value}</p></div>;
}
