import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Boxes,
  ChevronRight,
  Cloud,
  Code2,
  Database,
  GitBranch,
  Globe,
  KeyRound,
  Layers,
  Rocket,
  ShieldCheck,
  Terminal,
  Wallet,
  Zap,
} from "lucide-react";
import { ShelbyLogo } from "../components/shelbyhost/AppShell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — ShelbyHost" },
      {
        name: "description",
        content:
          "ShelbyHost documentation: architecture, deployment workflow, Aptos integration, Shelby Protocol uploads, build commands, and API reference.",
      },
      { property: "og:title", content: "ShelbyHost Documentation" },
      {
        property: "og:description",
        content:
          "Everything you need to deploy decentralized frontends on ShelbyHost — Shelby Protocol storage, Aptos registry, and the full build pipeline.",
      },
    ],
  }),
  component: DocsPage,
});

const sections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "getting-started", label: "Getting started", icon: Rocket },
  { id: "wallets", label: "Aptos wallets", icon: Wallet },
  { id: "shelby", label: "Shelby Protocol", icon: Cloud },
  { id: "deployments", label: "Deployments", icon: Zap },
  { id: "github", label: "GitHub integration", icon: GitBranch },
  { id: "domains", label: "Custom domains", icon: Globe },
  { id: "build", label: "Build commands", icon: Terminal },
  { id: "security", label: "Security & RLS", icon: ShieldCheck },
  { id: "api", label: "API reference", icon: Code2 },
  { id: "data-model", label: "Data model", icon: Database },
  { id: "secrets", label: "Secrets", icon: KeyRound },
  { id: "troubleshooting", label: "Troubleshooting", icon: Boxes },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 mt-16 mb-4 text-2xl font-extrabold tracking-tight text-foreground"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-3 text-lg font-bold text-foreground">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-md border border-border bg-card p-4 font-mono text-xs text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground">
      {children}
    </code>
  );
}

function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-grid opacity-90" />

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <ShelbyLogo />
          </Link>
          <nav className="flex items-center gap-4 text-sm font-bold">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link to="/deploy" className="text-muted-foreground hover:text-foreground">
              Deploy
            </Link>
            <Link
              to="/docs"
              className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
            >
              Docs
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Documentation
            </p>
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <article className="max-w-3xl">
          <p className="text-sm font-extrabold uppercase tracking-wider text-primary">
            Documentation
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            ShelbyHost developer docs
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Decentralized frontend hosting on Shelby Protocol, anchored to Aptos. This guide
            covers the full surface area: architecture, the deploy pipeline, wallet integration,
            GitHub auto-deploys, custom domains, and the API.
          </p>

          <H2 id="overview">Overview</H2>
          <P>
            ShelbyHost lets you upload a static frontend (Vite, Next export, plain HTML) to the
            Shelby Protocol storage network and register the resulting content hash on the Aptos
            blockchain. Every deploy is immutable, verifiable, and content-addressed.
          </P>
          <P>
            Three planes work together: a <strong>control plane</strong> (this dashboard, hosted
            on Lovable Cloud), the <strong>storage plane</strong> (Shelby nodes that pin your
            files), and the <strong>settlement plane</strong> (Aptos testnet, where the registry
            contract lives at <Inline>move/shelby_registry</Inline>).
          </P>

          <H2 id="architecture">Architecture</H2>
          <P>The end-to-end flow on a deployment:</P>
          <Code>{`User browser
    │  drag-drop dist/  or GitHub push
    ▼
ShelbyHost dashboard  ── Privy auth + Aptos wallet ──► Lovable Cloud (Supabase)
    │
    │  signed upload (wallet signature)
    ▼
Shelby Protocol storage nodes  ──►  content hash (SHA-256)
    │
    ▼
Aptos testnet  ──►  shelby_registry::register(slug, hash)
    │
    ▼
<slug>.shelbyhost.xyz served from Shelby nodes`}</Code>

          <H3>Tech stack</H3>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            <li>TanStack Start (React 19, Vite 7, file-based routing)</li>
            <li>Tailwind v4 with semantic design tokens in <Inline>src/styles.css</Inline></li>
            <li>Lovable Cloud (Supabase) for auth, project metadata, deployment history</li>
            <li>Privy for multi-method login (email, Google, GitHub, wallet)</li>
            <li>@aptos-labs/ts-sdk + @aptos-labs/wallet-adapter-react on testnet</li>
            <li>Shelby Protocol SDK for signed uploads (server-side, key in Cloud secrets)</li>
            <li>Move smart contract in <Inline>move/shelby_registry/sources/registry.move</Inline></li>
          </ul>

          <H2 id="getting-started">Getting started</H2>
          <ol className="ml-5 list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Sign in with Privy on the home page (email, Google, or wallet).</li>
            <li>Connect a Petra or Martian wallet on Aptos testnet.</li>
            <li>Open the Deploy tab, drop a <Inline>dist/</Inline> folder or pick a GitHub repo.</li>
            <li>Confirm the on-chain registration transaction in your wallet.</li>
            <li>Your project goes live at <Inline>&lt;slug&gt;.shelbyhost.xyz</Inline>.</li>
          </ol>

          <H2 id="wallets">Aptos wallets</H2>
          <P>
            ShelbyHost uses the official Aptos Wallet Adapter and falls back to the injected
            <Inline>window.aptos</Inline> object for Petra and Martian. Network is hard-coded
            to <strong>testnet</strong> — mainnet support is gated behind a feature flag.
          </P>
          <P>
            All on-chain calls go through the registry module published at the address declared
            in <Inline>move/shelby_registry/Move.toml</Inline>. The dashboard surfaces the
            connected address, network, and last transaction hash for every deployment.
          </P>

          <H2 id="shelby">Shelby Protocol</H2>
          <P>
            Files are uploaded to Shelby nodes through a server function that holds your
            <Inline>SHELBY_API_KEY</Inline>. The server signs the upload with the user's wallet
            signature so the storage node can attribute the blob to the correct Aptos account.
          </P>
          <P>
            The endpoint is configured via the <Inline>SHELBY_API_ENDPOINT</Inline> secret. Both
            secrets live in Lovable Cloud and are never exposed to the browser bundle.
          </P>

          <H2 id="deployments">Deployments</H2>
          <P>
            Every deploy creates a row in <Inline>shelby_deployments</Inline> with a status of
            <Inline>queued → pending → succeeded | failed</Inline> and the resulting content
            hash. Failed deploys keep their logs for debugging in the dashboard's Build Logs
            terminal (Vercel-style streaming view).
          </P>
          <P>
            Rolling back is instant — pick any historical hash from the project's deployments
            list and click "Promote". The registry entry on Aptos is updated in a single tx.
          </P>

          <H2 id="github">GitHub integration</H2>
          <P>
            Link a GitHub account in the dashboard (Privy OAuth). Pushes to the configured
            branch trigger an automatic deploy via the
            <Inline>github-webhook</Inline> edge function. Workflow file:
            <Inline>.github/workflows/shelbyhost-deploy.yml</Inline>.
          </P>

          <H2 id="domains">Custom domains</H2>
          <P>
            Add a CNAME pointing to <Inline>shelbyhost.pages.dev</Inline> and verify it from the
            project settings. The <Inline>verify-domain</Inline> edge function checks DNS, SSL,
            and writes the mapping into <Inline>shelby_domain_mappings</Inline>.
          </P>

          <H2 id="build">Build commands</H2>
          <P>Use the right script for the right environment — production ≠ preview.</P>
          <Code>{`npm run dev         # local development on :8080
npm run build:dev   # preview / staging (vite build --mode development)
npm run build       # production (tsc + vite build)
npm run preview     # smoke test the production bundle
npm run lint        # ESLint`}</Code>
          <P>
            CI runs <Inline>node scripts/check-required-scripts.mjs</Inline> first; any missing
            script fails the pipeline before a build is even attempted. This is the guardrail
            that prevents "Script not found 'build:dev'" from ever reaching Vercel.
          </P>

          <H2 id="security">Security & RLS</H2>
          <P>
            All Cloud tables (<Inline>shelby_projects</Inline>, <Inline>shelby_deployments</Inline>,
            <Inline>shelby_domain_mappings</Inline>, <Inline>shelby_github_*</Inline>, and
            <Inline>shelby_wallet_connections</Inline>) have row-level security enabled. The
            policy in every table requires <Inline>owner_id = auth.uid()</Inline> or ownership
            of the parent project, so a leaked anon key cannot read another user's data.
          </P>
          <P>
            The service-role key is only used inside server functions
            (<Inline>src/integrations/supabase/client.server.ts</Inline>). It is never imported
            into a component or a route loader.
          </P>

          <H2 id="api">API reference</H2>
          <P>Server endpoints exposed by the app:</P>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <Inline>POST /api/proxy-project</Inline> — proxies requests to a deployed slug.
            </li>
            <li>
              Edge function <Inline>github-repos</Inline> — lists the user's GitHub repos.
            </li>
            <li>
              Edge function <Inline>github-webhook</Inline> — receives push events.
            </li>
            <li>
              Edge function <Inline>verify-domain</Inline> — DNS + SSL check for custom domains.
            </li>
          </ul>

          <H2 id="data-model">Data model</H2>
          <Code>{`shelby_projects          (id, slug, name, owner_id, content_hash, files, ...)
shelby_deployments       (id, project_id, status, trigger, version_url, hash, ...)
shelby_domain_mappings   (id, project_id, domain, status, target, ...)
shelby_github_accounts   (id, owner_id, login, access_token_encrypted, ...)
shelby_github_connections(id, project_id, account, repository, branch, ...)
shelby_wallet_connections(id, owner_id, chain, wallet_provider, address, ...)`}</Code>

          <H2 id="secrets">Secrets</H2>
          <P>Configured in Lovable Cloud (runtime-only, never in the browser):</P>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            <li><Inline>SHELBY_API_KEY</Inline> — auth for Shelby uploads</li>
            <li><Inline>SHELBY_API_ENDPOINT</Inline> — Shelby node URL</li>
            <li><Inline>GITHUB_OAUTH_CLIENT_ID / SECRET</Inline> — GitHub app</li>
            <li><Inline>GITHUB_TOKEN_ENCRYPTION_SECRET</Inline> — encrypts stored tokens</li>
            <li><Inline>SUPABASE_SERVICE_ROLE_KEY</Inline> — admin DB access</li>
            <li><Inline>LOVABLE_API_KEY</Inline> — Lovable AI Gateway</li>
          </ul>

          <H2 id="troubleshooting">Troubleshooting</H2>
          <H3>"Script not found 'build:dev'"</H3>
          <P>
            CI now blocks this. If you still see it, run
            <Inline>node scripts/check-required-scripts.mjs</Inline> locally and add the missing
            script.
          </P>
          <H3>Deploy works locally but fails on Vercel</H3>
          <P>
            Local likely uses <Inline>build:dev</Inline> (skips <Inline>tsc</Inline>) while Vercel
            uses <Inline>build</Inline>. Run <Inline>npm run build</Inline> locally to surface
            type errors, or set Vercel's build command to <Inline>build:dev</Inline> for preview
            branches.
          </P>
          <H3>404 on refresh</H3>
          <P>
            <Inline>vercel.json</Inline> ships a SPA rewrite. Confirm it's at the repo root and
            that the framework preset on Vercel is set to "Other".
          </P>
          <H3>Wallet not connecting</H3>
          <P>
            Make sure Petra/Martian is installed and set to <strong>testnet</strong>. The dashboard
            displays the active network — if it shows mainnet, switch in your wallet and reload.
          </P>

          <div className="mt-16 flex items-center justify-between rounded-lg border border-border bg-card p-5">
            <div>
              <p className="text-sm font-bold text-foreground">Ready to deploy?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect your wallet and ship a project in under a minute.
              </p>
            </div>
            <Link
              to="/deploy"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
            >
              Start deploying <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}