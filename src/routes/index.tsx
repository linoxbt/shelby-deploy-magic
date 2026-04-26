import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Boxes, CheckCircle2, CloudUpload, Globe2, Github, Network, ShieldCheck, Sparkles } from "lucide-react";
import { LogoMark } from "../components/shelbyhost/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShelbyHost — Decentralized Frontend Hosting" },
      { name: "description", content: "Deploy static frontends to Shelby decentralized hot storage with GitHub deploys, custom domains, and zero-budget hosting." },
      { property: "og:title", content: "ShelbyHost — deploy once. live forever." },
      { property: "og:description", content: "A Vercel-inspired dashboard for Shelby-powered permanent frontend hosting." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Network, title: "Decentralized Storage", body: "Your files live on Shelby's global node mesh, not a single cloud account." },
  { icon: CloudUpload, title: "Instant Deploy", body: "Drag, drop, live in seconds. No config files required for static builds." },
  { icon: Globe2, title: "Custom Domains", body: "Point one CNAME at ShelbyHost and let the gateway resolve the right project." },
];

function Index() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-grid" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <LogoMark />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <a href="#features" className="transition hover:text-primary">Features</a>
          <a href="#workflow" className="transition hover:text-primary">Workflow</a>
          <Link to="/dashboard" className="transition hover:text-primary">Dashboard</Link>
        </nav>
      </header>

      <section className="relative mx-auto grid min-h-[82vh] max-w-7xl content-center px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="max-w-3xl animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" /> deploy once. live forever.
          </div>
          <h1 className="text-balance text-5xl font-extrabold leading-tight tracking-normal text-foreground sm:text-6xl lg:text-7xl">
            Deploy anything. Own everything.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            ShelbyHost stores your frontend on Shelby decentralized hot storage — censorship-resistant, permanently accessible, and completely free during testnet.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/deploy" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
              Deploy Now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/dashboard" className="inline-flex items-center justify-center rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary hover:shadow-glow">
              View Showcase
            </Link>
          </div>
        </div>

        <div className="mt-12 lg:mt-0">
          <div className="relative mx-auto max-w-xl rounded-lg border border-border bg-card/80 p-4 shadow-panel backdrop-blur animate-float">
            <div className="rounded-md border border-border bg-background/80 p-4">
              <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                <span className="font-mono text-sm text-primary">shelbyhost.gateway</span>
                <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">Live</span>
              </div>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex items-center justify-between rounded-md bg-secondary p-3"><span>myproject.com</span><span className="text-primary">lunex-finance</span></div>
                <div className="flex items-center justify-between rounded-md bg-secondary p-3"><span>app.aurumx.io</span><span className="text-primary">aurumx-landing</span></div>
                <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-primary">Host header matched → Shelby hash resolved</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-sidebar/70 px-5 py-6">
        <div className="mx-auto grid max-w-7xl gap-4 text-center sm:grid-cols-3">
          {["847 projects deployed", "12.4 GB stored", "99.98% uptime"].map((stat) => {
            const [number, ...label] = stat.split(" ");
            return <p key={stat} className="text-muted-foreground"><span className="font-mono text-xl font-bold text-primary">{number}</span> {label.join(" ")}</p>;
          })}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-lg border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-glow">
                <Icon className="h-7 w-7 text-primary" />
                <h2 className="mt-5 text-xl font-bold text-foreground">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {["Upload your build folder", "ShelbyHost pushes it to Shelby nodes", "Your site is live at a verifiable URL"].map((step, index) => (
            <div key={step} className="rounded-lg border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">{index + 1}</div>
              <p className="mt-5 font-bold text-foreground">{step}</p>
              <p className="mt-2 text-sm text-muted-foreground">{index === 0 ? "Use drag-and-drop, GitHub Actions, or a pre-built dist folder." : index === 1 ? "A content hash records the exact frontend artifact." : "Cloudflare handles SSL while Shelby keeps content addressable."}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-sidebar px-5 py-8 text-sm text-muted-foreground sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <LogoMark />
          <div className="flex gap-5"><span>Docs</span><span>GitHub</span><span>Discord</span></div>
          <p>powered by Shelby protocol</p>
        </div>
      </footer>
    </main>
  );
}
