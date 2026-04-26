import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, FileCode2, Github, Globe2, Loader2, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, formatBytes } from "../components/shelbyhost/AppShell";
import { useShelbyHost, type FileEntry, type Project } from "../context/ShelbyHostContext";

export const Route = createFileRoute("/deploy")({
  head: () => ({ meta: [{ title: "Deploy — ShelbyHost" }, { name: "description", content: "Deploy a static site to ShelbyHost by upload, GitHub Actions, or pre-built output." }] }),
  component: Deploy,
});

const deploymentSteps = ["Packaging files...", "Uploading to Shelby nodes...", "Registering content hash on Aptos...", "Assigning URL...", "Deployment complete!"];

function Deploy() {
  const { addProject, generateHash, generateSlug } = useShelbyHost();
  const [name, setName] = useState("my-dapp");
  const [description, setDescription] = useState("Static frontend deployed through ShelbyHost.");
  const [files, setFiles] = useState<FileEntry[]>([
    { name: "index.html", size: 18420, type: "HTML", path: "/index.html" },
    { name: "assets/main.js", size: 224800, type: "JS", path: "/assets/main.js" },
    { name: "assets/style.css", size: 32800, type: "CSS", path: "/assets/style.css" },
  ]);
  const [activeStep, setActiveStep] = useState(0);
  const [deployed, setDeployed] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const slug = useMemo(() => generateSlug(name), [generateSlug, name]);
  const size = files.reduce((sum, file) => sum + file.size, 0);

  const deploy = () => {
    setDeployed(null);
    setActiveStep(0);
    deploymentSteps.forEach((_, index) => {
      window.setTimeout(() => setActiveStep(index), 850 * (index + 1));
    });
    window.setTimeout(() => {
      const project = addProject({ name, slug, description, files, size, hash: generateHash(), source: "drag-drop" });
      setDeployed(project);
    }, 4700);
  };

  const addMockFile = () => {
    setFiles((current) => [...current, { name: `assets/module-${current.length}.js`, size: 42000 + current.length * 1000, type: "JS", path: `/assets/module-${current.length}.js` }]);
  };

  const copyUrl = async () => {
    if (!deployed) return;
    await navigator.clipboard?.writeText(`https://shelbyhost.pages.dev/p/${deployed.slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 xl:grid-cols-[1fr_0.85fr]">
        <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <p className="text-sm font-semibold text-primary">Deploy method</p>
          <h1 className="mt-2 text-3xl font-extrabold text-foreground">Ship a frontend to Shelby</h1>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[{ icon: UploadCloud, title: "Drag & drop" }, { icon: Github, title: "GitHub repo" }, { icon: Globe2, title: "Custom domain" }].map((item) => {
              const Icon = item.icon;
              return <div key={item.title} className="rounded-md border border-border bg-secondary p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-bold text-foreground">{item.title}</p></div>;
            })}
          </div>

          <button onClick={addMockFile} className="mt-6 flex min-h-64 w-full scale-100 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/40 p-8 text-center transition hover:scale-[1.01] hover:border-primary hover:shadow-glow">
            <UploadCloud className="h-10 w-10 text-primary" />
            <span className="mt-4 text-lg font-bold text-foreground">Drag your build folder here</span>
            <span className="mt-2 text-sm text-muted-foreground">Supports HTML, CSS, JS, images, fonts. Max 50MB per project.</span>
            <span className="mt-3 text-sm font-semibold text-primary">Or click to browse files</span>
          </button>

          <div className="mt-6 rounded-lg border border-border bg-background/50">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold text-foreground">{files.length} files selected</span>
              <span className="font-mono text-xs text-primary">{formatBytes(size)}</span>
            </div>
            {files.map((file) => (
              <div key={file.path} className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0">
                <FileCode2 className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{file.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                <button onClick={() => setFiles((current) => current.filter((item) => item.path !== file.path))} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${file.name}`}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-foreground">Project Name<input value={name} onChange={(event) => setName(event.target.value)} className="rounded-md border border-input bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring" /></label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="rounded-md border border-input bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring" /></label>
            <div className="rounded-md border border-border bg-secondary p-3 font-mono text-sm text-primary">Your URL: shelbyhost.pages.dev/p/{slug}</div>
            <button onClick={deploy} className="h-12 rounded-md bg-primary px-5 text-sm font-extrabold text-primary-foreground transition hover:bg-primary-hover hover:shadow-glow">Deploy to Shelby</button>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <h2 className="text-xl font-bold text-foreground">Deployment Status</h2>
          <div className="mt-6 space-y-4">
            {deploymentSteps.map((step, index) => {
              const done = activeStep > index || deployed;
              const current = activeStep === index && !deployed;
              return <div key={step} className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{done ? <CheckCircle2 className="h-4 w-4" /> : current ? <Loader2 className="h-4 w-4 animate-spin" /> : index + 1}</div><span className={done || current ? "text-foreground" : "text-muted-foreground"}>{step}</span></div>;
            })}
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all duration-700" style={{ width: `${deployed ? 100 : Math.min((activeStep + 1) * 20, 80)}%` }} /></div>

          {deployed && (
            <div className="mt-6 rounded-lg border border-primary/50 bg-primary/10 p-5 shadow-glow">
              <h3 className="text-xl font-extrabold text-foreground">Your site is live!</h3>
              <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background p-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-primary">shelbyhost.pages.dev/p/{deployed.slug}</span>
                <button onClick={copyUrl} className="text-primary"><Copy className="h-4 w-4" /></button>
              </div>
              <p className="mt-3 font-mono text-xs text-muted-foreground">CID: {deployed.hash.slice(0, 8)}...{deployed.hash.slice(-4)}</p>
              <div className="mt-5 flex gap-3"><a href={`https://shelbyhost.pages.dev/p/${deployed.slug}`} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Visit Site</a><Link to="/dashboard" className="rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground">View Dashboard</Link></div>
              {copied && <p className="mt-3 text-sm font-semibold text-success">✓ Copied!</p>}
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
