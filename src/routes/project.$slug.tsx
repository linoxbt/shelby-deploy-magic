import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileCode2,
  GitBranch,
  GitCommit,
  Globe2,
  HardDrive,
  LayoutGrid,
  Loader2,
  RefreshCcw,
  Rocket,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { AppShell, formatBytes, StatusBadge } from "../components/shelbyhost/AppShell";
import {
  projectPublicUrl,
  useShelbyHost,
  type GithubWorkflowSetup,
} from "../context/ShelbyHostContext";

export const Route = createFileRoute("/project/$slug")({
  head: () => ({
    meta: [
      { title: "Project — ShelbyHost" },
      {
        name: "description",
        content:
          "ShelbyHost project deployment details, file tree, hashes, and custom domain status.",
      },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const {
    projects,
    loading,
    deleteProject,
    updateProject,
    registerDomain,
    connectGithub,
    getGithubAppStatus,
    getGithubWorkflow,
    rotateGithubDeployToken,
    setupGithubApp,
    triggerGithubDeploy,
    verifyDomain,
  } = useShelbyHost();
  const { authenticated, ready } = usePrivy();

  useEffect(() => {
    if (ready && !authenticated) {
      navigate({ to: "/" });
    }
  }, [ready, authenticated, navigate]);

  const project = projects.find((item) => item.slug === slug);
  const [tab, setTab] = useState<
    "overview" | "deployments" | "files" | "domains" | "activity" | "settings"
  >("overview");
  const [framework, setFramework] = useState(project?.framework ?? "vite");
  const [buildOutput, setBuildOutput] = useState(project?.buildOutput ?? "dist");
  const [domain, setDomain] = useState(project?.domain?.domain ?? "");
  const [repo, setRepo] = useState(project?.github?.repository ?? "shelby-frontend");
  const [repoOwner, setRepoOwner] = useState(project?.github?.account ?? "");
  const [branch, setBranch] = useState(project?.github?.branch ?? "main");
  const [workflowSetup, setWorkflowSetup] = useState<GithubWorkflowSetup | null>(null);
  const [githubAppStatus, setGithubAppStatus] = useState<{
    configured: boolean;
    installUrl: string | null;
  } | null>(null);
  const [installationId, setInstallationId] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void getGithubAppStatus().then((status) => {
      if (status) setGithubAppStatus(status);
    });

    const params = new URLSearchParams(window.location.search);
    const installedId = params.get("installation_id");
    if (installedId) setInstallationId(installedId);
  }, [getGithubAppStatus]);

  if (!ready || loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!authenticated) return null;

  if (!project) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-3xl font-bold text-foreground">Project not found</h1>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const publicUrl = projectPublicUrl(project.slug).replace(/^https?:\/\//, "");
  const latest = project.deployments[0];
  const successCount = project.deployments.filter(
    (d) => d.status === "succeeded" || d.status === "verified",
  ).length;
  const failCount = project.deployments.filter((d) => d.status === "failed").length;
  const successRate = project.deployments.length
    ? Math.round((successCount / project.deployments.length) * 100)
    : 100;

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  const loadWorkflowSetup = async () => {
    const setup = await getGithubWorkflow(project.slug);
    if (setup) setWorkflowSetup(setup);
  };

  const connectRepository = async () => {
    const owner = repo.includes("/") ? repo.split("/")[0] : repoOwner;
    const repository = repo.includes("/") ? repo.split("/")[1] : repo;
    const setup = await connectGithub(project.slug, {
      account: owner,
      repository,
      branch,
      workflowFile: ".github/workflows/shelbyhost-deploy.yml",
    });
    if (setup) setWorkflowSetup(setup);
  };

  const configureGitHubApp = async () => {
    if (!githubAppStatus?.configured) {
      await connectRepository();
      return;
    }

    if (!installationId && githubAppStatus.installUrl) {
      window.location.assign(githubAppStatus.installUrl);
      return;
    }

    const owner = repo.includes("/") ? repo.split("/")[0] : repoOwner;
    const repository = repo.includes("/") ? repo.split("/")[1] : repo;
    const setup = await setupGithubApp(project.slug, {
      installationId,
      account: owner,
      repository,
      branch,
      workflowFile: ".github/workflows/shelbyhost-deploy.yml",
    });
    if (setup) setWorkflowSetup(setup);
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "deployments", label: "Deployments", icon: Rocket },
    { id: "files", label: "Files", icon: FileCode2 },
    { id: "domains", label: "Domains", icon: Globe2 },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ] as const;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground">{project.name}</span>
        </div>

        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-md border border-border bg-card text-lg font-extrabold text-primary">
                {project.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                    {project.name}
                  </h1>
                  <StatusBadge status={project.status} />
                </div>
                <a
                  href={`https://${publicUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1.5 font-mono text-sm text-primary hover:underline"
                >
                  {publicUrl} <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://${publicUrl}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-primary"
            >
              <Eye className="h-4 w-4" /> Visit
            </a>
            {project.github && (
              <button
                onClick={() => triggerGithubDeploy(project.slug)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-primary"
              >
                <RefreshCcw className="h-4 w-4" /> Redeploy
              </button>
            )}
            <a
              href={`https://${publicUrl}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
            >
              <ExternalLink className="h-4 w-4" /> Open
            </a>
          </div>
        </header>

        <nav className="mt-2 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        {tab === "overview" && (
          <div className="mt-6 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={Rocket}
                label="Deployments"
                value={project.deployments.length.toString()}
              />
              <Stat
                icon={CheckCircle2}
                label="Success rate"
                value={`${successRate}%`}
                accent={successRate >= 90 ? "success" : "warning"}
              />
              <Stat icon={HardDrive} label="Storage" value={formatBytes(project.size)} />
              <Stat icon={Database} label="Files" value={project.files.length.toString()} />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">Production deployment</h2>
                  {latest && <StatusBadge status={latest.status} />}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Domain"
                    value={publicUrl}
                    onCopy={() => copy(publicUrl, "url")}
                    copied={copied === "url"}
                  />
                  <Field
                    label="Content hash"
                    value={project.hash || "—"}
                    mono
                    onCopy={() => copy(project.hash, "hash")}
                    copied={copied === "hash"}
                  />
                  <Field label="Framework" value={project.framework ?? "vite"} />
                  <Field label="Chain" value={project.chain.toUpperCase()} />
                </div>
                {latest && (
                  <div className="mt-5 rounded-md border border-border bg-background/40 p-4">
                    <div className="flex items-center gap-3 text-sm">
                      <GitCommit className="h-4 w-4 text-primary" />
                      <span className="font-bold text-foreground">
                        {latest.message || "Deployment"}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />{" "}
                      {latest.timestamp ? new Date(latest.timestamp).toLocaleString() : "Unknown"}
                      <span>·</span>
                      <span>via {latest.trigger}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="text-lg font-bold text-foreground">Source</h2>
                {project.github ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-primary" />
                      <span className="font-bold text-foreground">
                        {project.github.account}/{project.github.repository}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      branch: {project.github.branch}
                    </p>
                    {project.github.lastPushAt && (
                      <p className="font-mono text-xs text-muted-foreground">
                        last push: {new Date(project.github.lastPushAt).toLocaleString()}
                      </p>
                    )}
                    <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-bold text-success">
                      Auto-deploy active
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-border p-4 text-center">
                    <GitBranch className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No Git repository connected
                    </p>
                    <button
                      onClick={() => setTab("settings")}
                      className="mt-3 text-xs font-bold text-primary hover:underline"
                    >
                      Connect repository
                    </button>
                  </div>
                )}
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="text-sm font-bold text-foreground">Domain</h3>
                  {project.domain ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs text-primary">
                        {project.domain.domain}
                      </span>
                      <StatusBadge status={project.domain.status as any} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No custom domain</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Recent deployments</h2>
                <button
                  onClick={() => setTab("deployments")}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  View all →
                </button>
              </div>
              <DeploymentList items={project.deployments.slice(0, 5)} />
            </section>
          </div>
        )}

        {tab === "deployments" && (
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Deployment history</h2>
                <p className="text-xs text-muted-foreground">
                  {successCount} succeeded · {failCount} failed
                </p>
              </div>
            </div>
            <DeploymentList items={project.deployments} detailed />
          </section>
        )}

        {tab === "files" && (
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Source files</h2>
              <span className="font-mono text-xs text-muted-foreground">
                {project.files.length} files · {formatBytes(project.size)}
              </span>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-background/60 px-4 py-2 text-xs font-bold uppercase text-muted-foreground">
                <span>Path</span>
                <span>Size</span>
                <span>Type</span>
              </div>
              {project.files.map((file) => (
                <div
                  key={file.path}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-background/40 px-4 py-3 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2 truncate font-mono text-sm text-foreground">
                    <FileCode2 className="h-4 w-4 text-primary" />
                    {file.path}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{file.type}</span>
                </div>
              ))}
              {project.files.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No files indexed
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "domains" && (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Add custom domain" icon={Globe2}>
              <p className="text-sm text-muted-foreground">
                Point your domain to this Shelby deployment.
              </p>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-foreground">
                Domain
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="myproject.com"
                  className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary"
                />
              </label>
              <button
                onClick={() => registerDomain(project.slug, domain)}
                className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
              >
                Register domain
              </button>
            </Panel>
            <Panel title="Active domains" icon={Shield}>
              {project.domain ? (
                <div className="rounded-md border border-border bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-foreground">{project.domain.domain}</span>
                    <StatusBadge status={project.domain.status as any} />
                  </div>
                  {project.domain.status !== "active" && (
                    <div className="mt-3 space-y-3">
                      <div className="rounded bg-background/50 p-2 text-[10px] text-muted-foreground">
                        <p className="font-bold uppercase text-primary">DNS Setup Instructions:</p>
                        <p className="mt-1">Please add a CNAME record to your DNS provider:</p>
                        <div className="mt-2 font-mono text-[10px]">
                          <p>Type: CNAME</p>
                          <p>Name: @ (or your desired subdomain)</p>
                          <p className="truncate text-primary font-bold">
                            Value: cname.vercel-dns.com
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => verifyDomain(project.slug, project.domain!.domain)}
                        className="w-full rounded bg-primary/10 py-1.5 text-xs font-extrabold text-primary transition hover:bg-primary/20"
                      >
                        Verify Now
                      </button>
                    </div>
                  )}
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    KV Path → {project.domain.kvKey}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No domains configured. The default URL{" "}
                  <span className="font-mono text-primary">{publicUrl}</span> is always available.
                </p>
              )}
            </Panel>
          </section>
        )}

        {tab === "activity" && (
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">Activity timeline</h2>
            <div className="mt-5 space-y-4">
              {project.deployments.map((d) => (
                <div key={d.id} className="flex gap-4">
                  <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background">
                    {d.status === "succeeded" || d.status === "verified" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : d.status === "failed" ? (
                      <Zap className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 border-b border-border pb-4">
                    <p className="text-sm font-bold text-foreground">
                      {d.message || `Deployment ${d.status}`}
                    </p>
                    <p className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {d.timestamp ? new Date(d.timestamp).toLocaleString() : "—"}
                      <span>·</span>
                      {d.trigger}
                      <span>·</span>
                      {d.hash?.slice(0, 8)}
                    </p>
                  </div>
                </div>
              ))}
              {project.deployments.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Build & framework" icon={SettingsIcon}>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Framework
                <input
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="mt-3 grid gap-2 text-sm font-semibold text-foreground">
                Build output
                <input
                  value={buildOutput}
                  onChange={(e) => setBuildOutput(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary"
                />
              </label>
              <button
                onClick={() => updateProject(project.slug, { framework, buildOutput }, "settings")}
                className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
              >
                Save
              </button>
            </Panel>
            <Panel title="Git integration" icon={GitBranch}>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Owner
                <input
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  placeholder="github-user-or-org"
                  className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Repository
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="repo-name or owner/repo"
                  className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="mt-3 grid gap-2 text-sm font-semibold text-foreground">
                Branch
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary"
                />
              </label>
              {githubAppStatus?.configured && (
                <label className="mt-3 grid gap-2 text-sm font-semibold text-foreground">
                  GitHub App installation ID
                  <input
                    value={installationId}
                    onChange={(e) => setInstallationId(e.target.value)}
                    placeholder="Returned by GitHub after app install"
                    className="rounded-md border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:border-primary"
                  />
                </label>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={configureGitHubApp}
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
                >
                  {githubAppStatus?.configured
                    ? installationId
                      ? "Auto-configure"
                      : "Install GitHub App"
                    : "Connect"}
                </button>
                <button
                  onClick={
                    project.github ? () => triggerGithubDeploy(project.slug) : loadWorkflowSetup
                  }
                  className="rounded-md border border-border px-4 py-2.5 text-sm font-bold text-foreground hover:border-primary"
                >
                  {project.github ? "Trigger deploy" : "Load setup"}
                </button>
              </div>
              {project.github && (
                <div className="mt-4 rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                  <p className="font-mono text-primary">
                    {project.github.account}/{project.github.repository}@{project.github.branch}
                  </p>
                  {project.github.automationStatus === "configured" && (
                    <p className="mt-1 font-bold text-success">GitHub App automation configured</p>
                  )}
                  <button
                    onClick={loadWorkflowSetup}
                    className="mt-2 font-bold text-primary hover:underline"
                  >
                    Show GitHub Actions setup
                  </button>
                </div>
              )}
              {workflowSetup && (
                <div className="mt-4 space-y-3 rounded-md border border-border bg-background/50 p-3">
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    <p>
                      GitHub secret:{" "}
                      <span className="font-mono text-primary">{workflowSetup.secretName}</span>
                      {workflowSetup.tokenLastFour && (
                        <span className="font-mono"> · ends {workflowSetup.tokenLastFour}</span>
                      )}
                    </p>
                    {workflowSetup.deployToken && (
                      <div className="rounded border border-warning/30 bg-warning/10 p-2">
                        <p className="font-bold text-warning">
                          {workflowSetup.automated
                            ? "Token was saved to GitHub."
                            : "Copy this token now."}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                            {workflowSetup.deployToken}
                          </code>
                          <button
                            onClick={() => copy(workflowSetup.deployToken!, "deploy-token")}
                            className="text-primary"
                          >
                            {copied === "deploy-token" ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-mono text-xs text-primary">{workflowSetup.workflowFile}</p>
                      <button
                        onClick={() => copy(workflowSetup.workflowYaml, "workflow")}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        {copied === "workflow" ? "Copied" : "Copy workflow"}
                      </button>
                    </div>
                    <pre className="max-h-72 overflow-auto rounded bg-secondary p-3 text-[11px] text-foreground">
                      {workflowSetup.workflowYaml}
                    </pre>
                  </div>
                  <button
                    onClick={async () => {
                      const setup = await rotateGithubDeployToken(project.slug);
                      if (setup) setWorkflowSetup(setup);
                    }}
                    className="rounded-md border border-border px-3 py-2 text-xs font-bold text-foreground hover:border-primary"
                  >
                    Rotate deploy token
                  </button>
                </div>
              )}
            </Panel>
            <Panel title="Danger zone" icon={Trash2}>
              <p className="text-sm text-muted-foreground">
                Permanently remove this project and all of its deployments. The on-chain hash will
                remain immutable.
              </p>
              <button
                onClick={async () => {
                  if (confirm(`Delete ${project.name}?`)) {
                    await deleteProject(project.slug);
                    navigate({ to: "/dashboard" });
                  }
                }}
                className="mt-4 w-full rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="mr-2 inline h-4 w-4" /> Delete project
              </button>
            </Panel>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon
          className={`h-4 w-4 ${accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-primary"}`}
        />
      </div>
      <p className="mt-3 font-mono text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p
          className={`min-w-0 flex-1 truncate text-sm text-foreground ${mono ? "font-mono text-primary" : ""}`}
        >
          {value}
        </p>
        {onCopy && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-foreground">
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function DeploymentList({ items, detailed }: { items: any[]; detailed?: boolean }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No deployments yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((d, i) => (
        <div
          key={d.id}
          className="grid gap-3 rounded-md border border-border bg-background/40 p-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
        >
          <div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background">
            <GitCommit className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {d.message || "Deployment"}
              {i === 0 && (
                <span className="ml-2 rounded-sm border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success">
                  Current
                </span>
              )}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {d.timestamp ? new Date(d.timestamp).toLocaleString() : "Unknown"} · {d.trigger}
              {detailed && d.hash && <> · {d.hash.slice(0, 10)}</>}
            </p>
          </div>
          <StatusBadge status={d.status as any} />
          <a
            href={d.versionUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> open
          </a>
        </div>
      ))}
    </div>
  );
}
