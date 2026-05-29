import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileCode2,
  Github,
  Globe2,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { AppShell, formatBytes } from "../components/shelbyhost/AppShell";
import { findFrameworkPreset, frameworkPresets } from "../lib/framework-presets";
import {
  useShelbyHost,
  type FileEntry,
  type Project,
  projectPublicUrl,
  type GithubWorkflowSetup,
} from "../context/ShelbyHostContext";
import { useAptosAddress, getAptosSignAndSubmit } from "../components/shelbyhost/AptosWallet";

export const Route = createFileRoute("/deploy")({
  head: () => ({
    meta: [
      { title: "Deploy — ShelbyHost" },
      {
        name: "description",
        content:
          "Deploy a static site to ShelbyHost by upload, GitHub Actions, or pre-built output.",
      },
    ],
  }),
  component: Deploy,
});

const deploymentSteps = [
  "Preparing files...",
  "Uploading to Shelby nodes...",
  "Paying deployment fee (0.1 USDT)...",
  "Registering on Aptos...",
  "Finalizing setup...",
];
const REGISTRY_ADDRESS =
  import.meta.env.VITE_REGISTRY_ADDRESS ||
  "0xc36c2abd4d6a6fd5d3c5823588d15c9ac5ae90a2357c3ce3083a98ce2184e4af";
const USDT_COIN_TYPE =
  import.meta.env.VITE_USDT_COIN_TYPE ||
  "0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1::shelby_coin::ShelbyUSDT";
const DEPLOY_FEE = 10000;
const TREASURY_ADDRESS =
  import.meta.env.VITE_TREASURY_ADDRESS ||
  "0xecf2ae74968ad5c25d281e8befeae00e4bee222a9f1b4b2ccbda6a846016bfff";

function Deploy() {
  const {
    addProject,
    loading,
    generateHash,
    generateSlug,
    checkBuildOutput,
    wallet,
    getWallet,
    fetchGithubRepos,
    uploadProgress,
    connectGithub,
  } = useShelbyHost();
  const { authenticated, ready } = usePrivy();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !authenticated) {
      navigate({ to: "/" });
    }
  }, [ready, authenticated, navigate]);

  const aptosAddress = useAptosAddress();
  const [name, setName] = useState("my-dapp");
  const [description, setDescription] = useState("Static frontend deployed through ShelbyHost.");
  const [framework, setFramework] = useState("vite");
  const [buildOutput, setBuildOutput] = useState("dist");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [repos, setRepos] = useState<any[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [deployed, setDeployed] = useState<Project | null>(null);
  const [workflowSetup, setWorkflowSetup] = useState<GithubWorkflowSetup | null>(null);
  const [copied, setCopied] = useState(false);

  const slug = useMemo(() => generateSlug(name), [generateSlug, name]);

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
  const size = files.reduce((sum, file) => sum + file.size, 0);
  const buildCheck = checkBuildOutput(files, buildOutput);
  const selectedPreset = findFrameworkPreset(framework);

  const deploy = async () => {
    setDeployed(null);
    setActiveStep(0);

    if (!buildCheck.valid) return;

    try {
      setActiveStep(1);
      const deployFiles = files.map((file) => ({
        ...file,
        path: file.path.startsWith(`/${buildOutput}/`)
          ? `/${file.path.slice(`/${buildOutput}/`.length)}`
          : file.path,
      }));
      const hash = await generateHash(deployFiles);

      const extensionSigner = getAptosSignAndSubmit();
      const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
      const managedSigner = async (tx: any) => {
        const accountData = await getWallet(true);
        if (!accountData?.privateKey) {
          throw new Error("Managed Aptos account is not available yet.");
        }
        const account = Account.fromPrivateKey({
          privateKey: new Ed25519PrivateKey(accountData.privateKey),
        });
        const transaction = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: tx.data ?? tx,
        });
        return aptos.signAndSubmitTransaction({ signer: account, transaction });
      };
      const signAndSubmit = extensionSigner || managedSigner;
      const signerAddress = aptosAddress || wallet?.address;
      if (!signerAddress) throw new Error("Aptos account is still being created.");

      // Step 2: Pay Deployment Fee (0.1 Shelby USDT)
      setActiveStep(2);
      toast.info("Paying 0.1 Shelby USDT deployment fee...");
      const feeResponse = await signAndSubmit({
          sender: signerAddress,
        data: {
          function: "0x1::coin::transfer",
          typeArguments: [USDT_COIN_TYPE],
          functionArguments: [TREASURY_ADDRESS, DEPLOY_FEE],
        },
      });
      await aptos.waitForTransaction({ transactionHash: feeResponse.hash });
      toast.success("Payment confirmed!");

      // Step 3: Register Aptos content hash
      setActiveStep(3);
      toast.info("Registering content hash on Aptos Registry...");
      const regResponse = await signAndSubmit({
        sender: signerAddress,
        data: {
          function: `${REGISTRY_ADDRESS}::registry::register_project`,
          typeArguments: [],
          functionArguments: [name, hash],
        },
      });

      await aptos.waitForTransaction({ transactionHash: regResponse.hash });

      setActiveStep(4);
      const project = await addProject({
        name,
        slug,
        description,
        files,
        size,
        hash,
        source: "drag-drop",
        framework,
        buildOutput,
        chain: "aptos",
        walletAddress: signerAddress,
        paymentTxHash: feeResponse.hash,
        registryTxHash: regResponse.hash,
      });

      if (project) {
        if (selectedRepo) {
          const setup = await connectGithub(project.slug, {
            account: selectedRepo.owner?.login ?? selectedRepo.full_name?.split("/")[0] ?? "",
            repository: selectedRepo.name,
            branch: selectedRepo.default_branch,
            workflowFile: ".github/workflows/shelbyhost-deploy.yml",
            buildCommand: selectedPreset.buildCommand,
          });
          if (setup) setWorkflowSetup(setup);
        }
        setActiveStep(4);
        setDeployed(project);
      }
    } catch (err: any) {
      console.error("Deployment error:", err);
      toast.error(`Deployment failed: ${err.message}`);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: FileEntry[] = Array.from(selectedFiles).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      path: file.webkitRelativePath ? `/${file.webkitRelativePath}` : `/${file.name}`,
      file: file,
    }));

    setFiles(newFiles);
  };

  const loadRepos = async () => {
    setFetchingRepos(true);
    try {
      const data = await fetchGithubRepos();
      setRepos(data);
    } finally {
      setFetchingRepos(false);
    }
  };

  const selectRepo = (repo: any) => {
    setSelectedRepo(repo);
    setName(repo.name);
    setDescription(repo.description || `Imported from ${repo.full_name}`);
    const placeholderHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${repo.name} on ShelbyHost</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="font-family:system-ui,sans-serif;max-width:720px;margin:12vh auto;padding:24px"><h1>${repo.name}</h1><p>This ShelbyHost project is connected to ${repo.full_name}. Add the generated GitHub Actions workflow to publish the first repository build.</p></main></body></html>`;
    const placeholder = new File([placeholderHtml], "index.html", { type: "text/html" });
    setFiles([
      {
        name: "index.html",
        size: placeholder.size,
        type: "text/html",
        path: "/index.html",
        file: placeholder,
      },
    ]);
  };

  const breakOutput = () =>
    setFiles((current) => current.filter((file) => !file.path.endsWith("/index.html")));
  const restoreOutput = () =>
    setFiles((current) => [
      {
        name: `${buildOutput}/index.html`,
        size: 18420,
        type: "HTML",
        path: `/${buildOutput}/index.html`,
      },
      ...current.filter((file) => !file.path.endsWith("/index.html")),
    ]);

  const copyUrl = async () => {
    if (!deployed) return;
    await navigator.clipboard?.writeText(projectPublicUrl(deployed.slug));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const copyWorkflow = async () => {
    if (!workflowSetup) return;
    await navigator.clipboard?.writeText(workflowSetup.workflowYaml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const copyDeployToken = async () => {
    if (!workflowSetup?.deployToken) return;
    await navigator.clipboard?.writeText(workflowSetup.deployToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 xl:grid-cols-[1fr_0.85fr]">
        <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <p className="text-sm font-extrabold uppercase text-muted-foreground">New deployment</p>
          <h1 className="mt-2 text-4xl font-extrabold text-foreground">Ship from upload or Git.</h1>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <button
              onClick={() => {
                setSelectedRepo(null);
                setRepos([]);
              }}
              className={`rounded-md border p-4 text-left transition ${!selectedRepo ? "border-primary bg-primary/5" : "border-border bg-secondary"}`}
            >
              <UploadCloud className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-bold text-foreground">Drag & drop</p>
            </button>
            <button
              onClick={loadRepos}
              className={`rounded-md border p-4 text-left transition ${selectedRepo || repos.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary"}`}
            >
              <Github className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-bold text-foreground">GitHub repo</p>
            </button>
            <div className="rounded-md border border-border bg-secondary p-4">
              <Globe2 className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-bold text-foreground">Custom domain</p>
            </div>
          </div>

          {repos.length > 0 && !selectedRepo && (
            <div className="mt-6 max-h-64 overflow-y-auto rounded-lg border border-border bg-background/50 p-2">
              <p className="px-2 py-1 text-xs font-bold uppercase text-muted-foreground">
                Select a repository
              </p>
              {repos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => selectRepo(repo)}
                  className="flex w-full items-center justify-between rounded-md p-3 text-left hover:bg-secondary transition"
                >
                  <div className="flex items-center gap-3">
                    <Github className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{repo.full_name}</span>
                    {repo.private && (
                      <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Private
                      </span>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {selectedRepo ? (
            <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-6 text-center">
              <Github className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-bold text-foreground">{selectedRepo.full_name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Branch: {selectedRepo.default_branch}
              </p>
              <button
                onClick={() => setSelectedRepo(null)}
                className="mt-4 text-xs font-bold text-primary hover:underline"
              >
                Change repository
              </button>
            </div>
          ) : (
            <label className="mt-6 flex min-h-52 w-full scale-100 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/40 p-8 text-center transition cursor-pointer hover:scale-[1.01] hover:border-primary hover:shadow-glow">
              <UploadCloud className="h-10 w-10 text-primary" />
              <span className="mt-4 text-lg font-bold text-foreground">
                Drop a production build
              </span>
              <span className="mt-2 text-sm text-muted-foreground">
                Select a directory to upload, validate output, then promote to live.
              </span>
              <span className="mt-3 text-sm font-semibold text-primary">
                Click to select folder
              </span>
              {/* @ts-ignore */}
              <input
                type="file"
                className="hidden"
                {...({ webkitdirectory: "", directory: "" } as any)}
                onChange={handleFileSelect}
              />
            </label>
          )}

          <div
            className={`mt-5 rounded-md border p-4 ${buildCheck.valid ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}
          >
            <div className="flex items-start gap-3">
              {buildCheck.valid ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="text-sm font-bold text-foreground">Deployment checker</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {selectedRepo
                    ? "✓ GitHub source selected. Initial placeholder will reserve the subdomain; the workflow promotes the first build."
                    : buildCheck.message}
                </p>
              </div>
            </div>
            {!selectedRepo && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={restoreOutput}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-bold text-foreground"
                >
                  Restore index
                </button>
                <button
                  onClick={breakOutput}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-bold text-foreground"
                >
                  Test failure
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-border bg-background/50">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold text-foreground">
                {files.length} files selected
              </span>
              <span className="font-mono text-xs text-primary">{formatBytes(size)}</span>
            </div>
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
              >
                <FileCode2 className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                  {file.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
                <button
                  onClick={() =>
                    setFiles((current) => current.filter((item) => item.path !== file.path))
                  }
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Project Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="rounded-md border border-input bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="grid gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Application preset</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {frameworkPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setFramework(preset.id);
                        setBuildOutput(preset.output);
                      }}
                      className={`rounded-md border p-3 text-left transition ${
                        framework === preset.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/60"
                      }`}
                    >
                      <span className="text-sm font-bold text-foreground">{preset.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {preset.runtime.toUpperCase()} · {preset.output}
                      </span>
                    </button>
                  ))}
                </div>
                {selectedPreset.status === "runner-required" && (
                  <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
                    {selectedPreset.label} is configured as a preset. Native SSR/serverless/edge
                    execution requires the ShelbyHost runner layer; current deploys publish static
                    build artifacts.
                  </p>
                )}
              </div>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Build output
                <input
                  value={buildOutput}
                  onChange={(event) => setBuildOutput(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <div className="rounded-md border border-border bg-secondary p-3 font-mono text-sm text-primary">
              Live URL: {slug}.shelbyhost.xyz
            </div>
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-xs font-bold uppercase text-muted-foreground">Aptos account</p>
              <p className="mt-1 truncate font-mono text-sm text-primary">
                {wallet?.address || "Creating account..."}
              </p>
            </div>
            <button
              onClick={deploy}
              disabled={!buildCheck.valid || (!aptosAddress && !wallet?.address)}
              className="h-12 rounded-md bg-primary px-5 text-sm font-extrabold text-primary-foreground transition hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Deployment
            </button>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <h2 className="text-xl font-bold text-foreground">Build Status</h2>
          <div className="mt-6 space-y-4">
            {deploymentSteps.map((step, index) => {
              const done = activeStep > index || deployed;
              const current = activeStep === index && !deployed;
              return (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : current ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={done || current ? "text-foreground" : "text-muted-foreground"}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: `${deployed ? 100 : Math.min((activeStep + 1) * 20, 80)}%` }}
            />
          </div>

          {uploadProgress !== null && (
            <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-bold text-foreground">
                Uploading files… {uploadProgress}%
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          {deployed && (
            <div className="mt-6 rounded-lg border border-primary/50 bg-primary/10 p-5 shadow-glow">
              <h3 className="text-xl font-extrabold text-foreground">Deployment ready.</h3>
              <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background p-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-primary">
                  {projectPublicUrl(deployed.slug)}
                </span>
                <button onClick={copyUrl} className="text-primary">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                Aptos hash: {deployed.hash.slice(0, 8)}...{deployed.hash.slice(-4)}
              </p>
              <div className="mt-5 flex gap-3">
                <a
                  href={projectPublicUrl(deployed.slug)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  Visit Site
                </a>
                <Link
                  to="/dashboard"
                  className="rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground"
                >
                  View Dashboard
                </Link>
              </div>
              {copied && <p className="mt-3 text-sm font-semibold text-success">✓ Copied!</p>}
            </div>
          )}
          {workflowSetup && (
            <div className="mt-6 rounded-lg border border-border bg-background/50 p-5">
              <h3 className="text-lg font-extrabold text-foreground">GitHub Actions setup</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add this secret to the selected repository, then commit the workflow file below.
              </p>
              <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs font-bold text-warning">{workflowSetup.secretName}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {workflowSetup.deployToken}
                  </code>
                  <button onClick={copyDeployToken} className="text-xs font-bold text-primary">
                    Copy
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-primary">{workflowSetup.workflowFile}</p>
                <button onClick={copyWorkflow} className="text-xs font-bold text-primary">
                  Copy workflow
                </button>
              </div>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-secondary p-3 text-[11px] text-foreground">
                {workflowSetup.workflowYaml}
              </pre>
            </div>
          )}

          <div className="mt-8 border-t border-border pt-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Public Registry</span>
              <span className="font-mono text-primary">
                {REGISTRY_ADDRESS.slice(0, 6)}...{REGISTRY_ADDRESS.slice(-4)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Platform Fee</span>
              <span className="font-bold text-foreground">0.1 Shelby USDT</span>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
              Fees are sent to the treasury to support decentralized hosting infrastructure.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
