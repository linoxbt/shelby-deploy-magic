import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CloudUpload,
  GitBranch,
  Github,
  Globe2,
  MessageCircle,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { AptosWalletButton } from "../components/shelbyhost/AptosWallet";
import { LogoMark } from "../components/shelbyhost/AppShell";
import { usePrivy } from "@privy-io/react-auth";
import heroImage from "../assets/editorial-deploy-studio.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShelbyHost — Decentralized Frontend Hosting" },
      {
        name: "description",
        content:
          "Deploy static frontends to Shelby decentralized hot storage with GitHub deploys, custom domains, and zero-budget hosting.",
      },
      { property: "og:title", content: "ShelbyHost — deploy once. live forever." },
      {
        property: "og:description",
        content: "A modern control plane for Shelby-powered permanent frontend hosting.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: CloudUpload,
    title: "Preview Deployments",
    body: "Every upload creates a shareable build preview before you promote it to production.",
  },
  {
    icon: GitBranch,
    title: "Git-connected Projects",
    body: "Connect a repository, track branch deploys, and keep a complete deployment history.",
  },
  {
    icon: Globe2,
    title: "Domains & Rollbacks",
    body: "Route custom domains to the latest content hash and roll back from the project timeline.",
  },
];

function Index() {
  const { login, authenticated } = usePrivy();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuLinks = [
    { label: "Docs", icon: BookOpen, href: "#" },
    { label: "GitHub", icon: Github, href: "https://github.com" },
    { label: "Discord", icon: MessageCircle, href: "#" },
    { label: "Features", icon: Sparkles, href: "#features" },
    { label: "Workflow", icon: GitBranch, href: "#workflow" },
  ];
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="shelby-surface relative min-h-[92vh] overflow-hidden text-foreground">
        <img
          src={heroImage}
          alt="Editorial deploy studio with code preview"
          width={1600}
          height={1000}
          className="absolute inset-0 h-full w-full object-cover opacity-16 mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-background/35" />
        <header className="relative z-10 mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="grid h-10 w-10 place-items-center rounded-md border border-foreground/20 bg-card/65 text-foreground backdrop-blur transition hover:border-primary"
              >
                <Menu className="h-5 w-5" />
              </button>
              <LogoMark />
            </div>
            <nav className="hidden items-center gap-7 text-sm font-extrabold uppercase text-foreground sm:flex">
              <a href="#features" className="transition hover:opacity-70">
                Features
              </a>
              <a href="#workflow" className="transition hover:opacity-70">
                Workflow
              </a>
              {authenticated ? (
                <Link to="/dashboard" className="transition hover:opacity-70">
                  Dashboard
                </Link>
              ) : (
                <button onClick={() => login()} className="transition hover:opacity-70">
                  Login
                </button>
              )}
              <AptosWalletButton />
            </nav>
            <div className="sm:hidden">
              <AptosWalletButton compact />
            </div>
          </div>
          <nav className="mt-5 grid grid-cols-2 gap-2 text-sm font-bold sm:hidden">
            {authenticated ? (
              <Link
                to="/dashboard"
                className="rounded-md border border-foreground/20 bg-card/65 px-3 py-2 text-center text-foreground backdrop-blur transition hover:border-primary"
              >
                Dashboard
              </Link>
            ) : (
              <button
                onClick={() => login()}
                className="rounded-md border border-foreground/20 bg-card/65 px-3 py-2 text-center text-foreground backdrop-blur transition hover:border-primary"
              >
                Login
              </button>
            )}
            <Link
              to="/deploy"
              className="rounded-md bg-primary px-3 py-2 text-center text-primary-foreground transition hover:bg-primary-hover"
            >
              Deploy
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[76vh] max-w-7xl content-center px-5 pb-24 pt-12 text-center sm:px-8">
          <div className="mx-auto max-w-5xl animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/70 px-3 py-1.5 text-sm font-semibold text-foreground shadow-panel backdrop-blur">
              <Sparkles className="h-4 w-4" /> deploy once. live forever.
            </div>
            <h1 className="text-balance text-5xl font-extrabold leading-none tracking-normal text-foreground sm:text-7xl lg:text-8xl">
              Deploy frontends with permanent ownership.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              A professional deployment workflow for Shelby: previews, Git automation, custom
              domains, instant rollbacks, and Aptos-backed content hashes.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              {authenticated ? (
                <Link
                  to="/deploy"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-4 text-sm font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Deploy Now <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  onClick={() => login()}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-4 text-sm font-extrabold text-primary-foreground shadow-glow transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Start Deploying <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {authenticated && (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center rounded-md border border-foreground/20 bg-card/65 px-6 py-4 text-sm font-extrabold text-foreground backdrop-blur transition hover:border-primary hover:text-primary"
                >
                  View Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card px-5 py-7">
        <div className="mx-auto grid max-w-7xl gap-4 text-center sm:grid-cols-3">
          {["847 preview deploys", "12.4 GB stored", "99.98% uptime"].map((stat) => {
            const [number, ...label] = stat.split(" ");
            return (
              <p key={stat} className="text-muted-foreground">
                <span className="font-mono text-xl font-bold text-foreground">{number}</span>{" "}
                {label.join(" ")}
              </p>
            );
          })}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-extrabold uppercase text-muted-foreground">Platform</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            The deployment control plane for decentralized frontends.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-lg border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-glow"
              >
                <Icon className="h-7 w-7 text-primary" />
                <h2 className="mt-5 text-xl font-bold text-foreground">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {["Create a project", "Preview every deployment", "Promote with domains"].map(
            (step, index) => (
              <div key={step} className="rounded-lg border border-border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                  {index + 1}
                </div>
                <p className="mt-5 font-bold text-foreground">{step}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {index === 0
                    ? "Import a repository or upload a compiled build output."
                    : index === 1
                      ? "Each build gets logs, status, immutable hash, and a preview URL."
                      : "Assign production domains while Shelby keeps content addressable."}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      <footer className="border-t border-border bg-sidebar px-5 py-8 text-sm text-muted-foreground sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <LogoMark />
          <p>powered by Shelby protocol</p>
        </div>
      </footer>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 flex-col border-r border-border bg-sidebar p-6 text-sidebar-foreground shadow-panel animate-in slide-in-from-left">
            <div className="flex items-center justify-between">
              <LogoMark />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-md border border-sidebar-foreground/15 hover:border-sidebar-foreground/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-8 grid gap-1">
              {menuLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-sidebar-foreground/80 transition hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </a>
                );
              })}
            </nav>
            <div className="mt-auto grid gap-2 border-t border-sidebar-foreground/15 pt-5">
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="rounded-md border border-sidebar-foreground/20 px-3 py-2.5 text-center text-sm font-bold text-sidebar-foreground transition hover:border-primary"
              >
                Dashboard
              </Link>
              <Link
                to="/deploy"
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-primary px-3 py-2.5 text-center text-sm font-extrabold text-primary-foreground transition hover:bg-primary-hover"
              >
                Deploy
              </Link>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
