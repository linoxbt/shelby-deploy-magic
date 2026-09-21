import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Github,
  Loader2,
  Plus,
  Server,
  ShieldCheck,
  UploadCloud,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { AppShell, formatBytes, StatusBadge } from "../components/shelbyhost/AppShell";
import { ProjectCard } from "../components/shelbyhost/ProjectCard";
import { useShelbyHost } from "../context/ShelbyHostContext";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ShelbyHost" },
      {
        name: "description",
        content:
          "Manage ShelbyHost projects, storage usage, deployments, GitHub deploys, wallets, and domains.",
      },
    ],
  }),
  component: Dashboard,
});

interface GithubAccount {
  login: string;
  avatar_url: string | null;
  html_url: string | null;
}

interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  pushedAt: string | null;
  language: string | null;
}

function Dashboard() {
  const { projects, loading, wallet, connectGithub, fetchGithubRepos, linkGithub } =
    useShelbyHost();
  const { user, authenticated, ready } = useAuth();
  const navigate = useNavigate();

  const [githubAccount, setGithubAccount] = useState<GithubAccount | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [repoStatus, setRepoStatus] = useState("Connect GitHub to fetch your repositories.");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);

  useEffect(() => {
    if (ready && !authenticated) {
      navigate({ to: "/" });
    }
  }, [ready, authenticated, navigate]);

  useEffect(() => {
    const github = user?.linkedAccounts.find((acc) => acc.type === "github_oauth") as any;
    if (github) {
      setGithubAccount({
        login: github.username || github.name || "User",
        avatar_url: null,
        html_url: null,
      });
    } else {
      setGithubAccount(null);
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchGithubRepos();
        if (data && data.length > 0) {
          const mapped = data.map((r: any) => ({
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            owner: r.owner.login,
            private: r.private,
            defaultBranch: r.default_branch,
            htmlUrl: r.html_url,
            pushedAt: r.pushed_at,
            language: r.language,
          }));
          setRepos(mapped);
          setSelectedRepo((current) => current || mapped[0] || null);
          setRepoStatus(`${data.length} repositories fetched from GitHub.`);
        } else {
          setRepos([]);
          setSelectedRepo(null);
          setRepoStatus(
            "GitHub is connected, but no repositories were returned. Check repository authorization.",
          );
        }
      } catch (error) {
        console.error("Dashboard repo fetch error:", error);
      }
    };
    if (authenticated) {
      loadData();
    }
  }, [fetchGithubRepos, authenticated]);

  const totalSize = useMemo(
    () => projects.reduce((sum, project) => sum + project.size, 0),
    [projects],
  );
  const latestDeployments = useMemo(
    () =>
      projects
        .flatMap((project) =>
          project.deployments.map((deployment) => ({
            ...deployment,
            projectName: project.name,
            slug: project.slug,
          })),
        )
        .sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, 6),
    [projects],
  );

  const firstProject = projects[0];

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

  const importSelectedRepo = async () => {
    if (!firstProject || !selectedRepo) return;
    await connectGithub(firstProject.slug, {
      account: selectedRepo.owner,
      repository: selectedRepo.name,
      branch: selectedRepo.defaultBranch,
      workflowFile: ".github/workflows/shelbyhost-deploy.yml",
    });
    navigate({ to: "/project/$slug", params: { slug: firstProject.slug } });
  };

  const stats = [
    { label: "Total Projects", value: projects.length.toString(), icon: Server },
    { label: "Total Storage", value: formatBytes(totalSize), icon: UploadCloud },
    {
      label: "Deploy Attempts",
      value: projects.reduce((sum, project) => sum + project.deployments.length, 0).toString(),
      icon: Zap,
    },
    { label: "Uptime", value: "99.98%", icon: ShieldCheck },
  ];

  return (
    <AppShell>
      <div className="console-page">
        <header className="dashboard-hero">
          <div>
            <p className="console-eyebrow">Deployment workspace</p>
            <h1 className="console-title">
              Build. Ship. <em>Stay in control.</em>
            </h1>
            <p className="console-subtitle">
              Your projects, immutable releases, and real-time build activity in one focused
              workspace.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/settings" className="console-secondary">
              {wallet ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : "Account"}
            </Link>
            <Link to="/deploy" className="console-primary">
              <Plus className="h-4 w-4" /> New Deployment
            </Link>
          </div>
        </header>

        <section className="dashboard-stats">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="dashboard-stat">
                <span className="stat-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <p>{stat.label}</p>
                  <strong>{stat.value}</strong>
                </div>
                <ArrowRight size={14} />
              </div>
            );
          })}
        </section>

        <section className="dashboard-grid">
          <div className="console-panel p-5">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Import Git repository</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect GitHub, choose a real repository, then attach it to your next deployment.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={async () => {
                  await linkGithub();
                  const data = await fetchGithubRepos();
                  const mapped = data.map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    fullName: r.full_name,
                    owner: r.owner.login,
                    private: r.private,
                    defaultBranch: r.default_branch,
                    htmlUrl: r.html_url,
                    pushedAt: r.pushed_at,
                    language: r.language,
                  }));
                  setRepos(mapped);
                  setSelectedRepo(mapped[0] || null);
                  setRepoStatus(
                    data.length
                      ? `${data.length} repositories fetched from GitHub.`
                      : "GitHub is connected, but no repositories were returned. Check repo authorization scopes.",
                  );
                }}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
              >
                <Github className="h-4 w-4" />{" "}
                {githubAccount ? `Refresh @${githubAccount.login}` : "Connect GitHub"}
              </button>
              {githubAccount?.avatar_url && (
                <img
                  src={githubAccount.avatar_url}
                  alt={`${githubAccount.login} avatar`}
                  className="h-10 w-10 rounded-full border border-border"
                />
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{repoStatus}</p>
            {repos.length > 0 && (
              <div className="mt-4 grid gap-3">
                <select
                  value={selectedRepo?.id ?? ""}
                  onChange={(event) =>
                    setSelectedRepo(
                      repos.find((repo) => repo.id === Number(event.target.value)) ?? null,
                    )
                  }
                  className="rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName} · {repo.defaultBranch}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!firstProject || !selectedRepo}
                  onClick={importSelectedRepo}
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  Use selected repo
                </button>
              </div>
            )}
            {firstProject?.github && (
              <p className="mt-4 font-mono text-xs text-primary">
                {firstProject.github.repository}@{firstProject.github.branch}
              </p>
            )}
          </div>

          <div className="console-panel p-5">
            <h2 className="text-lg font-bold text-foreground">Recent deployments</h2>
            <div className="mt-4 space-y-3">
              {latestDeployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="grid gap-3 rounded-md border border-border bg-background/40 p-3 sm:grid-cols-[1fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {deployment.projectName}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(deployment.timestamp).toLocaleString()} · {deployment.trigger}
                    </p>
                  </div>
                  <StatusBadge status={deployment.status} />
                  <a
                    href={deployment.versionUrl}
                    className="font-mono text-xs font-bold text-primary"
                  >
                    latest
                  </a>
                </div>
              ))}
              {latestDeployments.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent deployments found.</p>
              )}
            </div>
          </div>
        </section>

        <section className="projects-section">
          <div className="projects-heading">
            <div>
              <p className="console-eyebrow">Production</p>
              <h2>Projects</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Live frontends with previews, domains, Git integrations, and immutable hashes.
            </p>
            <Link to="/deploy" className="console-secondary">
              <Plus size={14} /> New project
            </Link>
          </div>
          {projects.length ? (
            <div className="projects-grid">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 text-xl font-bold text-foreground">
                No deployments yet. Ship your first project.
              </h3>
              <Link
                to="/deploy"
                className="mt-6 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Deploy Now
              </Link>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
