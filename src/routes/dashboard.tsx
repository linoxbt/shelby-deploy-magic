import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Plus, Server, ShieldCheck, UploadCloud, Wallet, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
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

interface GithubReposResponse {
  account: GithubAccount | null;
  repos: GithubRepo[];
}

function Dashboard() {
  const { projects, wallet, connectWallet, connectGithub, fetchGithubRepos, linkGithub } = useShelbyHost();
  const { user } = usePrivy();
  const [githubAccount, setGithubAccount] = useState<GithubAccount | null>(null);

  useEffect(() => {
    const github = user?.linkedAccounts.find(acc => acc.type === 'github_oauth') as any;
    if (github) {
      setGithubAccount({
        login: github.username || github.name || "User",
        avatar_url: null, // Privy might not provide this directly in the account object
        html_url: null
      });
    } else {
      setGithubAccount(null);
    }
  }, [user]);

  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [repoStatus, setRepoStatus] = useState("Connect GitHub to fetch your repositories.");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const totalSize = projects.reduce((sum, project) => sum + project.size, 0);
  const latestDeployments = projects
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
    .slice(0, 6);
  const firstProject = projects[0];

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchGithubRepos();
        if (data && data.length > 0) {
          setRepos(data.map((r: any) => ({
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            owner: r.owner.login,
            private: r.private,
            defaultBranch: r.default_branch,
            htmlUrl: r.html_url,
            pushedAt: r.pushed_at,
            language: r.language
          })));
          setRepoStatus(`${data.length} repositories fetched from GitHub.`);
        }
      } catch (error) {
        console.error("Dashboard repo fetch error:", error);
      }
    };
    loadData();
  }, [fetchGithubRepos]);

  const importSelectedRepo = () => {
    if (!firstProject || !selectedRepo) return;
    connectGithub(firstProject.slug, {
      account: selectedRepo.owner,
      repository: selectedRepo.name,
      branch: selectedRepo.defaultBranch,
    });
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
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase text-muted-foreground">Overview</p>
            <h1 className="mt-2 text-4xl font-extrabold text-foreground">
              Projects and deployments.
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => connectWallet("aptos")}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-foreground"
            >
              <Wallet className="h-4 w-4" /> {wallet ? "Aptos Connected" : "Connect Aptos"}
            </button>
            <Link
              to="/deploy"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> New Deployment
            </Link>
          </div>
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
                <p className="mt-4 font-mono text-3xl font-bold text-foreground">{stat.value}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Import Git repository</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect GitHub, choose a real repository, then attach it to your next deployment.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={githubAccount ? fetchGithubRepos : linkGithub}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
              >
                <Github className="h-4 w-4" />{" "}
                {githubAccount ? `Connected @${githubAccount.login}` : "Link GitHub with Privy"}
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
                {firstProject.github.repository}@{firstProject.github.branch} →{" "}
                {firstProject.github.workflowFile}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
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
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-foreground">Projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live frontends with previews, domains, Git integrations, and immutable hashes.
            </p>
          </div>
          {projects.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
