import { useAptosSession, AptosWalletButton } from "../components/shelbyhost/AptosWallet";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { Github, UploadCloud, Loader2, ArrowRight } from "lucide-react";
import { AppShell } from "../components/shelbyhost/AppShell";
import { useShelbyHost } from "../context/ShelbyHostContext";
import { apiRequest } from "../lib/api";
export const Route = createFileRoute("/deploy")({
  component: Deploy,
  head: () => ({ meta: [{ title: "Deploy application source — ShelbyHost" }] }),
});
function Deploy() {
  const { address } = useAptosSession();
  const { authenticated, ready, getAccessToken } = useAuth(),
    navigate = useNavigate();
  const { fetchGithubRepos, linkGithub, refreshProjects } = useShelbyHost();
  const [mode, setMode] = useState<"github" | "upload">("github"),
    [repo, setRepo] = useState(""),
    [branch, setBranch] = useState("main"),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [rootDirectory, setRoot] = useState("."),
    [buildCommand, setBuild] = useState(""),
    [outputDirectory, setOutput] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [repos, setRepos] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loadingRepos, setLoadingRepos] = useState(false);
  useEffect(() => {
    if (ready && !authenticated) navigate({ to: "/" });
  }, [ready, authenticated, navigate]);
  const [publishing, setPublishing] = useState<{
    feeAtomic: string;
    coinType: string | null;
    network: string;
  }>();
  useEffect(() => {
    if (authenticated)
      void apiRequest<{
        publishing: { feeAtomic: string; coinType: string | null; network: string };
      }>("/api/system/status", {}, getAccessToken)
        .then((result) => setPublishing(result.publishing))
        .catch((e) => setError(e.message));
  }, [authenticated, getAccessToken]);
  async function loadRepos() {
    setLoadingRepos(true);
    try {
      setRepos(await fetchGithubRepos());
    } finally {
      setLoadingRepos(false);
    }
  }
  async function deploy() {
    setBusy(true);
    setError("");
    try {
      let source: any = {
        kind: "github",
        repository: repo
          .trim()
          .replace(/^https:\/\/github.com\//, "")
          .replace(/\.git$/, ""),
        branch,
      };
      if (mode === "upload") {
        if (files.reduce((n, f) => n + f.size, 0) > 2 * 1024 * 1024)
          throw new Error("Source exceeds 2 MiB. Connect GitHub for larger projects.");
        const entries = [];
        for (const file of files) {
          const relative = file.webkitRelativePath || file.name;
          const path = file.webkitRelativePath ? relative.split("/").slice(1).join("/") : relative;
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          entries.push({ path, content: btoa(binary) });
        }
        source = { kind: "upload", files: entries };
      }
      const result = await apiRequest<{ project: { slug: string }; deploymentId: string }>(
        "/api/deployments",
        {
          method: "POST",
          body: {
            walletAddress: address,
            name,
            slug: slug || name,
            source,
            config: {
              rootDirectory,
              ...(buildCommand ? { buildCommand } : {}),
              ...(outputDirectory ? { outputDirectory } : {}),
            },
          },
        },
        getAccessToken,
      );
      await refreshProjects();
      await navigate({ to: "/project/$slug", params: { slug: result.project.slug } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready || !authenticated)
    return (
      <AppShell>
        <div className="p-12">
          <Loader2 className="animate-spin" />
        </div>
      </AppShell>
    );
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6 sm:p-10">
        <p className="text-xs font-bold uppercase text-muted-foreground">New application</p>
        <h1 className="mt-2 text-3xl font-bold">From source to a live deployment.</h1>
        <p className="mt-3 text-muted-foreground">
          ShelbyHost installs dependencies, runs your build, validates the output, stores it on
          Shelby, and publishes only after every stage succeeds.
        </p>
        <div className="mt-7 flex gap-3">
          <button
            onClick={() => setMode("github")}
            aria-pressed={mode === "github"}
            className={`flex items-center gap-2 rounded border px-4 py-3 ${mode === "github" ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <Github size={18} />
            GitHub repository
          </button>
          <button
            onClick={() => setMode("upload")}
            aria-pressed={mode === "upload"}
            className={`flex items-center gap-2 rounded border px-4 py-3 ${mode === "upload" ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <UploadCloud size={18} />
            Source folder
          </button>
        </div>
        <div className="mt-5 space-y-5 rounded-lg border border-border bg-card p-6">
          {mode === "github" ? (
            <>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => linkGithub()}
                  className="rounded border border-border px-3 py-2 text-sm"
                >
                  Connect GitHub
                </button>
                <button
                  onClick={loadRepos}
                  disabled={loadingRepos}
                  className="rounded border border-border px-3 py-2 text-sm"
                >
                  {loadingRepos ? "Loading repositories…" : "Load repositories"}
                </button>
              </div>
              {repos.length > 0 && (
                <label className="block text-sm">
                  Your repositories
                  <select
                    aria-label="Select repository"
                    value={repo}
                    onChange={(e) => {
                      const item = repos.find((r) => r.full_name === e.target.value);
                      setRepo(e.target.value);
                      if (item) {
                        setBranch(item.default_branch);
                        setName(item.name);
                      }
                    }}
                    className="mt-2 w-full rounded border border-border bg-background p-3"
                  >
                    <option value="">Choose a repository</option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.full_name}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Field label="Repository" value={repo} set={setRepo} placeholder="owner/repository" />
              <Field label="Production branch" value={branch} set={setBranch} />
            </>
          ) : (
            <label className="block rounded border border-dashed border-border p-5 text-sm">
              Upload application source, including package.json. Exclude node_modules, .git, and
              .env files.
              <input
                type="file"
                multiple
                {...({ webkitdirectory: "", directory: "" } as any)}
                aria-label="Source directory"
                onChange={(e) =>
                  setFiles(
                    Array.from(e.target.files || []).filter(
                      (f) =>
                        !(f.webkitRelativePath || f.name)
                          .split("/")
                          .some(
                            (part) =>
                              part === "node_modules" ||
                              part === ".git" ||
                              part === ".env" ||
                              part.startsWith(".env."),
                          ),
                    ),
                  )
                }
                className="mt-4 block w-full"
              />
              <span className="mt-3 block text-muted-foreground">
                {files.length} files selected · maximum 2 MiB
              </span>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name" value={name} set={setName} placeholder="My application" />
            <Field
              label="Subdomain"
              value={slug}
              set={setSlug}
              placeholder="Generated from project name"
            />
          </div>
          <Field label="Root directory" value={rootDirectory} set={setRoot} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Build command"
              value={buildCommand}
              set={setBuild}
              placeholder="Auto-detect from package.json"
            />
            <Field
              label="Output directory"
              value={outputDirectory}
              set={setOutput}
              placeholder="Auto-detect after build"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Applications must produce static output. SSR servers, serverless functions, and build
            steps requiring external network access are not supported by this worker.
          </p>
        </div>
        <div className="mt-5 rounded-lg border border-border bg-card p-5 text-sm">
          <strong>Publishing account and fee</strong>
          <AptosWalletButton />
          <p className="mt-2 break-all font-mono text-xs">
            {address || "Connect your Aptos wallet"}
          </p>
          <p className="mt-2 break-all">
            {publishing
              ? `Project fee: ${publishing.feeAtomic} base units of ${publishing.coinType || "the configured fee token"} on ${publishing.network}.`
              : "Loading publishing fee…"}
          </p>
          <p className="mt-2 text-muted-foreground">
            Connect an Aptos wallet funded with APT for gas and the fee token. After the build is
            stored on Shelby, approve the project fee and content-hash registration in your wallet.
            Redeployments reuse the project fee receipt.
          </p>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-5 whitespace-pre-wrap rounded bg-destructive/10 p-4 text-destructive"
          >
            {error}
          </div>
        )}
        <button
          onClick={deploy}
          disabled={
            busy || !address || !name.trim() || (mode === "github" ? !repo.trim() : !files.length)
          }
          className="mt-6 flex items-center gap-3 rounded bg-primary px-6 py-3 font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}{" "}
          {busy ? "Queuing build…" : "Deploy application"}
        </button>
      </div>
    </AppShell>
  );
}
function Field({
  label,
  value,
  set,
  placeholder,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded border border-border bg-background p-3 font-normal"
      />
    </label>
  );
}
