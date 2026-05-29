import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  GitBranch,
  Globe2,
  Rocket,
  ServerCog,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { LogoMark } from "../components/shelbyhost/AppShell";

export const Route = createFileRoute("/grant")({
  head: () => ({
    meta: [
      { title: "ShelbyHost Platform Brief" },
      {
        name: "description",
        content:
          "A grant and fundraising overview of ShelbyHost: decentralized deployment, Git automation, Aptos ownership, and Shelby storage.",
      },
    ],
  }),
  component: GrantBrief,
});

const pillars = [
  {
    icon: GitBranch,
    title: "Developer Deployment Control Plane",
    body: "ShelbyHost gives builders a familiar deployment dashboard with GitHub imports, project timelines, framework presets, deployment status, and production subdomains.",
  },
  {
    icon: Database,
    title: "Decentralized Artifact Storage",
    body: "Every finalized build is staged through Supabase for upload reliability and mirrored into Shelby blobs when Shelby storage is enabled.",
  },
  {
    icon: Wallet,
    title: "Aptos-Native Ownership",
    body: "Each authenticated user receives a managed Aptos account, and deployments are tied to content hashes and wallet identity.",
  },
  {
    icon: Globe2,
    title: "Domains and Distribution",
    body: "Projects receive wildcard ShelbyHost subdomains, can attach custom domains, and are served through a Vercel-hosted control plane.",
  },
  {
    icon: Zap,
    title: "Path to Vercel Parity",
    body: "The product already handles static frontends and GitHub build finalization. The next funding milestone is native build runners, SSR, edge, env vars, logs, and PR previews.",
  },
  {
    icon: ShieldCheck,
    title: "Security and Recoverability",
    body: "Deploy tokens are hashed, GitHub tokens are encrypted, wallet private keys are encrypted server-side, and private key export is explicit.",
  },
];

const implemented = [
  "Email, Google, and GitHub authentication through Privy",
  "Managed Aptos account creation for every authenticated user",
  "Profile page with Aptos address, public key, and explicit private key export",
  "Project creation, upload validation, immutable content hashing, and deployment history",
  "Wildcard production URLs in the format your-app.shelbyhost.xyz",
  "GitHub repository import, deploy token generation, workflow generation, and GitHub App automation hooks",
  "GitHub Actions build success/failure handling with upload/finalize endpoints",
  "PR preview records, deployment logs, and project environment variable UI",
  "Optional Shelby blob mirroring for finalized artifacts using the Shelby TypeScript SDK",
  "Custom domain registration and verification flow for Vercel-hosted distribution",
];

const fundingMilestones = [
  {
    title: "Native compute layer",
    body: "Isolated Linux build workers, framework detection, cache restoration, dependency installation, and build cancellation so ShelbyHost can run builds directly instead of delegating compute to GitHub Actions.",
  },
  {
    title: "SSR, functions, and edge runtime",
    body: "Adapters for Next.js, TanStack Start, SvelteKit, Nuxt, Remix, React Router, Astro SSR, API functions, middleware, and edge routing.",
  },
  {
    title: "Storage and availability",
    body: "Shelby-first artifact publishing, resumable large uploads, manifest verification, multiple gateway paths, retention policies, and usage metering.",
  },
  {
    title: "Enterprise-grade operations",
    body: "Streaming logs, team roles, audit trails, spend limits, incident alerts, analytics, observability, and production support workflows.",
  },
];

function GrantBrief() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/85 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <LogoMark />
          <Link
            to="/"
            className="rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary"
          >
            Back home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="max-w-4xl">
          <p className="text-sm font-extrabold uppercase text-primary">Platform brief</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-foreground sm:text-6xl">
            ShelbyHost is a decentralized hosting control plane for modern frontend teams.
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            ShelbyHost is a deployment control plane that brings familiar cloud hosting workflows to
            decentralized storage. The app gives builders authentication, managed Aptos ownership,
            GitHub-based builds, deployment history, wildcard subdomains, custom domains, PR
            previews, environment variable management, and optional Shelby blob mirroring for build
            artifacts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/deploy"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground"
            >
              Deploy a project <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/dashboard"
              className="rounded-md border border-border px-5 py-3 text-sm font-extrabold text-foreground"
            >
              Open dashboard
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.title} className="rounded-lg border border-border bg-card p-6">
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="mt-5 text-xl font-bold text-foreground">{pillar.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
              </article>
            );
          })}
        </div>

        <section className="mt-14 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-border bg-card p-6">
            <Rocket className="h-6 w-6 text-primary" />
            <h2 className="mt-4 text-2xl font-extrabold text-foreground">
              What is product-ready today
            </h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              ShelbyHost is ready as a decentralized static frontend hosting MVP with GitHub Actions
              as the build runner. Users can deploy compiled output, connect GitHub, reserve
              production subdomains, and track artifacts by hash.
            </p>
          </div>
          <div className="grid gap-2">
            {implemented.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-sm leading-6 text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-lg border border-border bg-card p-6">
          <ServerCog className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-2xl font-extrabold text-foreground">
            Technical architecture
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ["Control plane", "Vercel-hosted React/TanStack app, Vercel Functions APIs, wildcard domain middleware, and Supabase service-role persistence."],
              ["Build path", "GitHub Actions runs install/build, reports success or failure, uploads static artifacts, and finalizes deployment records."],
              ["Ownership and storage", "Privy authenticates users, ShelbyHost creates managed Aptos accounts, and finalized assets can be mirrored to Shelby blobs."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-md border border-border bg-background/50 p-4">
                <p className="font-bold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <p className="text-sm font-extrabold uppercase text-primary">Funding milestones</p>
          <h2 className="mt-3 text-3xl font-extrabold text-foreground">
            The capital plan turns static decentralized hosting into full Vercel parity.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {fundingMilestones.map((milestone) => (
              <article key={milestone.title} className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-bold text-foreground">{milestone.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{milestone.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-lg border border-warning/30 bg-warning/10 p-6">
          <h2 className="text-2xl font-extrabold text-foreground">Important platform boundary</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Shelby is used here as decentralized/blob storage for build artifacts. ShelbyHost does
            not yet have native decentralized compute equivalent to Vercel serverless, edge, or SSR
            runtimes. GitHub Actions currently provides build compute and build success/failure
            signals. Funding is aimed at replacing that dependency with ShelbyHost-owned runners and
            runtime infrastructure.
          </p>
        </section>
      </section>
    </main>
  );
}
