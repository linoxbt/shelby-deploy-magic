import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Code2,
  FileCode2,
  Fingerprint,
  GitBranch,
  Github,
  Globe2,
  Layers3,
  Pause,
  Play,
  Plus,
  Terminal,
  UploadCloud,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DeployButton, PublicFooter, PublicHeader } from "../components/shelbyhost/PublicLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShelbyHost — A new home for what you build" },
      {
        name: "description",
        content:
          "Ship static sites with GitHub workflows, content-addressed deployments, and optional Shelby storage. Your next idea belongs on the web.",
      },
    ],
  }),
  component: Landing,
});

function DeploymentGraphic() {
  return (
    <div
      className="deployment-graphic"
      role="img"
      aria-label="Illustration: source files become a deployment and connect to a distributed storage network"
    >
      <div className="graphic-grid" />
      <div className="orbital-ring ring-one" />
      <div className="orbital-ring ring-two" />
      <svg className="network-lines" viewBox="0 0 620 560" fill="none" aria-hidden="true">
        <path
          d="M100 163 310 275 517 163M310 275v180M100 395l210-120 208 119"
          stroke="#d8d2c5"
          strokeWidth="1.3"
        />
        <path className="network-flow flow-one" d="M100 163 310 275 517 163" />
        <path className="network-flow flow-two" d="M310 455V275L100 395" />
        <path className="network-flow flow-three" d="m310 275 208 119" />
        {[
          [100, 163],
          [517, 163],
          [100, 395],
          [518, 394],
          [310, 455],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="8" fill="#f8f6ef" stroke="#cdc6b9" />
            <circle cx={cx} cy={cy} r="3" fill="#e96546" />
          </g>
        ))}
      </svg>
      <div className="source-chip">
        <FileCode2 size={17} />
        <span>your-next-big-thing</span>
        <span className="chip-ext">/ dist</span>
      </div>
      <div className="cube-scene">
        <div className="cube-base base-bottom" />
        <div className="cube-base base-middle" />
        <div className="cube-base base-top">
          <svg viewBox="0 0 90 90" aria-hidden="true">
            <path d="M23 26h43L56 39H35l-9 12h42L54 66H13l11-14h19l9-12H12z" fill="currentColor" />
          </svg>
        </div>
        <div className="cube-glow" />
      </div>
      <div className="network-label label-left">
        <span className="signal-dot" />
        Content addressed
      </div>
      <div className="network-label label-right">
        <Layers3 size={14} />
        Shelby storage
      </div>
      <div className="live-deploy-card">
        <span className="live-card-icon">
          <Check size={20} />
        </span>
        <div>
          <strong>Your idea is live.</strong>
          <span>your-project.shelbyhost.xyz</span>
        </div>
        <ArrowUpRight size={17} />
      </div>
      <div className="graphic-caption">
        <span>+</span>FROM LOCAL FILES TO A WORLD OF POSSIBILITIES<span>+</span>
      </div>
    </div>
  );
}

const questions = [
  [
    "What can I deploy on ShelbyHost?",
    "Any static website or frontend that builds to a folder containing index.html. That includes React, Vue, Vite, Astro static sites, and exported Next.js sites. Applications that need an SSR runtime or backend functions aren't supported yet.",
  ],
  [
    "Do I need to connect a wallet?",
    "Connect and authenticate an Aptos wallet through Dynamic. Initial publication requires testnet APT for gas and the configured deployment-fee token.",
  ],
  [
    "Where are my files stored?",
    "Files are staged in Supabase Storage. When Shelby mirroring is enabled by the platform, finalized files are also uploaded to Shelby blobs. The gateway prefers Shelby and can fall back to Supabase. Storage retention depends on the configured blob lifetime.",
  ],
  [
    "Can I use my existing GitHub workflow?",
    "Yes. Connect your repository in project settings and use the generated deployment workflow and project token. GitHub Actions builds your site, uploads the static output, and finalizes a production deployment or a pull-request preview.",
  ],
];

function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [source, setSource] = useState<"github" | "upload">("github");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    root.current?.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className={`public-site ${paused ? "motion-paused" : ""}`} id="top">
      <a className="public-skip" href="#main">
        Skip to content
      </a>
      <PublicHeader />
      <main id="main">
        <section className="landing-hero public-container">
          <div className="hero-copy">
            <a className="release-pill" href="#platform">
              <span className="signal-dot" />
              Built on Shelby. Built for what’s next.
              <ArrowRight size={13} />
            </a>
            <h1>
              Your next big idea.
              <br />
              Its new <span className="hero-serif">home.</span>
              <span className="hero-period">_</span>
            </h1>
            <p className="hero-description">
              From your first commit to your next launch. Deploy your frontend with a familiar
              workflow and a new foundation for the web.
            </p>
            <div className="hero-buttons">
              <DeployButton />
              <Link className="text-button" to="/docs" search={{ topic: "quickstart" }}>
                Read the docs
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span>
                <Check size={13} />
                Bring your favorite framework
              </span>
              <span>
                <Check size={13} />
                Own your deployment history
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <DeploymentGraphic />
            <button
              className="motion-control"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Play animations" : "Pause animations"}
            >
              {paused ? <Play size={12} /> : <Pause size={12} />}
              <span>{paused ? "Play motion" : "Pause motion"}</span>
            </button>
          </div>
        </section>
        <section className="framework-strip">
          <div className="public-container">
            <span className="framework-caption">
              YOUR STACK.
              <br />
              <strong>RIGHT AT HOME.</strong>
            </span>
            <div className="framework-list">
              <span>
                <svg viewBox="-12 -12 24 24" aria-hidden="true">
                  <g fill="none" stroke="currentColor">
                    <ellipse rx="11" ry="4" />
                    <ellipse rx="11" ry="4" transform="rotate(60)" />
                    <ellipse rx="11" ry="4" transform="rotate(120)" />
                  </g>
                  <circle r="2" fill="currentColor" />
                </svg>
                React
              </span>
              <span className="next-word">
                N
                <span>
                  Next.js<small>static export</small>
                </span>
              </span>
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M1 3h5l6 10 6-10h5L12 22z" fill="currentColor" />
                </svg>
                Vue
              </span>
              <span>
                <Code2 />
                Astro
              </span>
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m2 4 10 18L23 3l-11 3z" fill="currentColor" />
                  <path d="m14 1-5 12h4l-1 8 7-13h-5z" fill="#fbf9f4" />
                </svg>
                Vite
              </span>
              <span>
                <FileCode2 />
                HTML + CSS
              </span>
            </div>
          </div>
        </section>
        <section className="platform-section public-container" id="platform">
          <div className="section-heading reveal">
            <div>
              <span className="eyebrow">
                <span />
                LESS FRICTION. MORE SHIPPING.
              </span>
              <h2>
                Everything your frontend needs.
                <br />
                <span className="muted-heading">Nothing in your way.</span>
              </h2>
            </div>
            <p>
              The tools you already love, with content-addressed publishing and storage built for a
              more open web.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-git reveal">
              <div className="feature-top">
                <GitBranch />
                <span>01 / CONNECT</span>
              </div>
              <div className="git-illustration" aria-hidden="true">
                <div className="git-branch-line" />
                <div className="git-commit">
                  <Github size={19} />
                  <span>feat: something great</span>
                  <span className="commit-hash">a8f2c1</span>
                </div>
                <div className="git-build">
                  <span className="signal-dot" />
                  Building your next chapter
                  <span className="build-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="git-result">
                  <Check size={13} />
                  Deployment ready
                  <ArrowUpRight size={13} />
                </div>
              </div>
              <h3>Good things start with a push.</h3>
              <p>
                Connect GitHub and let your workflow take it from there. Build, upload, and publish
                from GitHub Actions.
              </p>
              <Link to="/docs" search={{ topic: "github" }}>
                Explore Git deployments
                <ArrowRight size={15} />
              </Link>
            </article>
            <article className="feature-card feature-storage reveal">
              <div className="feature-top">
                <Layers3 />
                <span>02 / STORE</span>
              </div>
              <div className="storage-illustration" aria-hidden="true">
                <div className="storage-orbit" />
                <span className="storage-node node-a" />
                <span className="storage-node node-b" />
                <span className="storage-node node-c" />
                <div className="storage-stack">
                  <div />
                  <div />
                  <div>
                    <Box size={27} />
                  </div>
                </div>
                <span className="storage-caption">One build. A new foundation.</span>
              </div>
              <h3>Your files. Beyond one server.</h3>
              <p>
                Stage reliably, then mirror to Shelby when enabled. A distributed storage layer for
                the things you create.
              </p>
              <Link to="/docs" search={{ topic: "storage" }}>
                Meet the storage layer
                <ArrowRight size={15} />
              </Link>
            </article>
            <article className="feature-card feature-proof reveal">
              <div className="feature-top">
                <Fingerprint />
                <span>03 / VERIFY</span>
              </div>
              <div className="proof-illustration" aria-hidden="true">
                <Fingerprint size={95} strokeWidth={1} />
                <div className="hash-chip">
                  <span>SHA-256</span>7f83…c2a9
                  <Check size={13} />
                </div>
              </div>
              <h3>A fingerprint for every build.</h3>
              <p>
                Content hashes identify your releases. Your initial project registration records its
                hash on Aptos.
              </p>
              <Link to="/docs" search={{ topic: "hashes" }}>
                Understand content hashes
                <ArrowRight size={15} />
              </Link>
            </article>
          </div>
        </section>
        <section className="workflow-section" id="how-it-works">
          <div className="public-container workflow-grid">
            <div className="workflow-copy reveal">
              <span className="eyebrow">
                <span />
                LOCAL TO LIVE
              </span>
              <h2>
                Keep your flow.
                <br />
                <span className="hero-serif">We’ll take it from here.</span>
              </h2>
              <p>
                No new language. No new framework. Just a shorter path between “what if” and “it’s
                live.”
              </p>
              <div className="workflow-tabs" aria-label="Deployment method">
                <button aria-pressed={source === "github"} onClick={() => setSource("github")}>
                  <Github size={16} />
                  Connect GitHub
                </button>
                <button aria-pressed={source === "upload"} onClick={() => setSource("upload")}>
                  <UploadCloud size={17} />
                  Upload a build
                </button>
              </div>
              <ol className="workflow-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>
                      {source === "github"
                        ? "Connect your repository"
                        : "Build something worth sharing"}
                    </strong>
                    <p>
                      {source === "github"
                        ? "Add your GitHub repository in project settings."
                        : "Run your build and find the output folder."}
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>
                      {source === "github"
                        ? "Give your workflow a home"
                        : "Drop it into ShelbyHost"}
                    </strong>
                    <p>
                      {source === "github"
                        ? "Configure the generated Actions workflow and deploy token."
                        : "Upload the folder containing your index.html."}
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>
                      {source === "github"
                        ? "Push. Publish. Repeat."
                        : "Register it. Make it live."}
                    </strong>
                    <p>
                      {source === "github"
                        ? "Your next push builds and publishes your frontend."
                        : "Confirm the fee and registry transactions, then publish."}
                    </p>
                  </div>
                </li>
              </ol>
            </div>
            <div className="terminal-window reveal" aria-live="polite">
              <div className="terminal-title">
                <span className="window-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {source === "github"
                    ? "your-project / GitHub Actions"
                    : "your-project / terminal"}
                </span>
                <Terminal size={15} />
              </div>
              <div className="terminal-body" key={source}>
                <div className="terminal-command">
                  <span>~</span> {source === "github" ? "git push origin main" : "npm run build"}
                  <span className="terminal-cursor" />
                </div>
                <p className="terminal-muted">
                  {source === "github"
                    ? "A little push. A big possibility."
                    : "Turning your source into something shareable."}
                </p>
                {(source === "github"
                  ? [
                      "Repository connected",
                      "Dependencies installed",
                      "Production build complete",
                      "Static assets uploaded",
                      "Deployment finalized",
                    ]
                  : [
                      "Compiling your frontend",
                      "Production build complete",
                      "dist/index.html found",
                      "Ready to upload to ShelbyHost",
                    ]
                ).map((line, i) => (
                  <div
                    className="terminal-line"
                    style={{ animationDelay: `${i * 180}ms` }}
                    key={line}
                  >
                    <Check size={14} />
                    <span>{line}</span>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                ))}
                <div className="terminal-output">
                  <span className="terminal-muted">
                    {source === "github"
                      ? "YOUR NEXT CHAPTER IS LIVE"
                      : "YOUR NEXT CHAPTER STARTS HERE"}
                  </span>
                  <p>
                    <span>↳</span> {source === "github" ? "your-project.shelbyhost.xyz" : "dist/"}
                  </p>
                </div>
                <span className="terminal-demo">
                  Illustrative workflow · no commands are run here
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="details-section public-container">
          <div className="section-heading reveal">
            <div>
              <span className="eyebrow">
                <span />
                THE FINISHING TOUCHES, INCLUDED
              </span>
              <h2>
                Built for the way <span className="hero-serif">you build.</span>
              </h2>
            </div>
          </div>
          <div className="detail-grid">
            <article className="detail-card reveal">
              <Globe2 />
              <h3>A place with your name on it.</h3>
              <p>
                Start with a project subdomain. Connect your own domain when you’re ready to make it
                yours.
              </p>
              <div className="domain-demo">
                <span className="signal-dot" />
                your-idea<span>.shelbyhost.xyz</span>
                <ArrowUpRight size={15} />
              </div>
            </article>
            <article className="detail-card reveal">
              <GitBranch />
              <h3>Share the work in progress.</h3>
              <p>
                Give each pull request a preview URL. Explore changes together before they reach
                production.
              </p>
              <div className="preview-demo">
                <span>PR #24</span>
                <span>A fresh perspective</span>
                <span className="preview-ready">
                  Ready
                  <Check size={12} />
                </span>
              </div>
            </article>
            <article className="detail-card reveal">
              <Code2 />
              <h3>Different context. Same workflow.</h3>
              <p>
                Configure build environment variables for production, previews, and development in
                project settings.
              </p>
              <div className="env-demo">
                <span>VITE_API_URL</span>
                <span>••••••••••••</span>
                <span>Production</span>
              </div>
            </article>
          </div>
        </section>
        <section className="faq-section public-container reveal">
          <div>
            <span className="eyebrow">
              <span />A FEW GOOD QUESTIONS
            </span>
            <h2>
              Before you
              <br />
              <span className="hero-serif">hit deploy.</span>
            </h2>
            <Link to="/docs" search={{ topic: "quickstart" }} className="text-button">
              Get into the details
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta public-container reveal">
          <div className="cta-grid" aria-hidden="true" />
          <div className="cta-decoration" aria-hidden="true">
            <Box strokeWidth={0.5} />
          </div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS WITH A DEPLOY</span>
          <h2>
            You build the next big thing.
            <br />
            We’ll make room for it.
          </h2>
          <div>
            <DeployButton>Let’s ship something</DeployButton>
            <Link to="/docs" search={{ topic: "quickstart" }} className="text-button">
              Take a look around
              <ChevronRight size={16} />
            </Link>
          </div>
          <p>Static sites. Open possibilities.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
