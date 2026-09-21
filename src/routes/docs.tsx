import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FileCode2,
  Fingerprint,
  GitBranch,
  Globe2,
  Info,
  Layers3,
  List,
  Search,
  Settings2,
  Terminal,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DeployButton, PublicFooter, PublicHeader } from "../components/shelbyhost/PublicLayout";

const topics = [
  {
    id: "quickstart",
    title: "Quickstart",
    group: "GET STARTED",
    icon: BookOpen,
    description:
      "Your first idea, deployed. Go from a local build to a public URL with ShelbyHost.",
    keywords: "start upload first deploy index.html",
  },
  {
    id: "frameworks",
    title: "Frameworks & builds",
    group: "GET STARTED",
    icon: FileCode2,
    description: "Bring your stack. ShelbyHost serves the static files your framework produces.",
    keywords: "react vue vite astro next output dist build",
  },
  {
    id: "wallets",
    title: "Accounts & wallets",
    group: "GET STARTED",
    icon: Wallet,
    description:
      "Understand sign-in, managed accounts, and the transactions for your first deployment.",
    keywords: "dynamic aptos wallet fee gas token testnet",
  },
  {
    id: "github",
    title: "GitHub deployments",
    group: "BUILD & DEPLOY",
    icon: GitBranch,
    description: "Connect source code to the isolated ShelbyHost build pipeline.",
    keywords: "git repository workflow branch push actions secret",
  },
  {
    id: "previews",
    title: "Preview deployments",
    group: "BUILD & DEPLOY",
    icon: Layers3,
    description: "Give work in progress a place on the web before it reaches production.",
    keywords: "pr pull request preview branch",
  },
  {
    id: "environment",
    title: "Environment variables",
    group: "BUILD & DEPLOY",
    icon: Settings2,
    description: "Keep build configuration organized across production, preview, and development.",
    keywords: "env variables secret api key configuration",
  },
  {
    id: "domains",
    title: "Custom domains",
    group: "GO LIVE",
    icon: Globe2,
    description: "Your site, your address. Connect a domain to a ShelbyHost project.",
    keywords: "dns cname custom domain subdomain verify",
  },
  {
    id: "storage",
    title: "Storage & delivery",
    group: "GO LIVE",
    icon: Layers3,
    description: "How your static files move from an upload to a visitor’s browser.",
    keywords: "shelby supabase storage blob hosting retention gateway",
  },
  {
    id: "hashes",
    title: "Content hashes",
    group: "GO LIVE",
    icon: Fingerprint,
    description: "A repeatable fingerprint for the contents and paths of a deployment.",
    keywords: "hash sha256 aptos registry integrity blockchain",
  },
];

export const Route = createFileRoute("/docs")({
  validateSearch: (search: Record<string, unknown>): { topic: string } => ({
    topic: topics.some((t) => t.id === search.topic) ? String(search.topic) : "quickstart",
  }),
  head: () => ({
    meta: [
      { title: "Documentation — ShelbyHost" },
      {
        name: "description",
        content:
          "Learn to deploy static sites with ShelbyHost: quickstart, GitHub Actions, previews, wallets, domains, and storage.",
      },
    ],
  }),
  component: Docs,
});

function CodeBlock({ code, label = "Terminal" }: { code: string; label?: string }) {
  const [status, setStatus] = useState("Copy");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("Copied");
    } catch {
      setStatus("Select code to copy");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("Copy"), 2500);
  }
  return (
    <div className="docs-code">
      <div>
        <span>
          <Terminal size={14} />
          {label}
        </span>
        <button onClick={copy} aria-label={`Copy ${label} code`}>
          {status === "Copied" ? <Check size={13} /> : <Copy size={13} />}
          <span aria-live="polite">{status}</span>
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <aside className="docs-note">
      <Info size={18} />
      <div>{children}</div>
    </aside>
  );
}
const headings: Record<string, [string, string][]> = {
  quickstart: [
    ["before-you-start", "Before you start"],
    ["build-your-site", "Build your site"],
    ["publish-your-build", "Publish your build"],
    ["what-next", "What’s next?"],
  ],
  frameworks: [
    ["supported-output", "Supported output"],
    ["build-settings", "Build settings"],
    ["check-your-output", "Check your output"],
  ],
  wallets: [
    ["sign-in", "Sign in"],
    ["choose-a-wallet", "Choose a wallet"],
    ["initial-transactions", "Initial transactions"],
  ],
  github: [
    ["connect-repository", "Connect a repository"],
    ["configure-workflow", "Configure the workflow"],
    ["publish-a-change", "Publish a change"],
  ],
  previews: [
    ["enable-previews", "Enable previews"],
    ["preview-addresses", "Preview addresses"],
    ["review-a-build", "Review a build"],
  ],
  environment: [
    ["add-a-variable", "Add a variable"],
    ["choose-a-target", "Choose a target"],
    ["build-time-values", "Build-time values"],
  ],
  domains: [
    ["project-subdomain", "Project subdomain"],
    ["connect-domain", "Connect your domain"],
    ["verify-dns", "Verify DNS"],
  ],
  storage: [
    ["upload-staging", "Upload staging"],
    ["shelby-mirroring", "Shelby artifact storage"],
    ["serving-files", "Serving files"],
  ],
  hashes: [
    ["how-hashing-works", "How hashing works"],
    ["aptos-registration", "Aptos registration"],
    ["verification-scope", "Verification scope"],
  ],
};

function Article({ topic }: { topic: string }) {
  if (topic === "quickstart")
    return (
      <>
        <div className="docs-intro-card">
          <div className="docs-intro-icon">
            <Layers3 size={30} />
          </div>
          <div>
            <span>FROM LOCAL TO LIVE</span>
            <strong>Small setup. Big possibilities.</strong>
            <p>Application source, an account, and your next idea.</p>
          </div>
        </div>
        <section id="before-you-start">
          <h2>
            <span className="docs-step">1</span>Before you start
          </h2>
          <p>
            You’ll need application source with a <code>package.json</code> build script, a
            ShelbyHost account, and a funded Aptos testnet wallet for the initial registration.
          </p>
          <ul className="docs-checklist">
            <li>
              <Check />
              Sign in with email, Google, or GitHub.
            </li>
            <li>
              <Check />
              Fund your connected Aptos wallet for user-approved publication.
            </li>
            <li>
              <Check />
              Have testnet APT for gas and the configured deployment-fee token.
            </li>
          </ul>
          <Note>
            The deployment screen shows the configured fee in token base units and its coin type. A
            wallet balance in another token cannot pay this fee.
          </Note>
        </section>
        <section id="build-your-site">
          <h2>
            <span className="docs-step">2</span>Build your site
          </h2>
          <p>Run your project’s production build. For a typical Vite project:</p>
          <CodeBlock code={"npm install\nnpm run build"} />
          <p>Your output folder should look something like this:</p>
          <CodeBlock
            label="Build output"
            code={
              "dist/\n├── index.html\n├── assets/\n│   ├── index-a1b2c3.js\n│   └── index-d4e5f6.css\n└── favicon.svg"
            }
          />
          <p>
            Use this local build to check your configuration. Submit source code to ShelbyHost; the
            worker runs its own build. Exclude <code>node_modules</code>, .git, and .env files.
          </p>
        </section>
        <section id="publish-your-build">
          <h2>
            <span className="docs-step">3</span>Publish your build
          </h2>
          <ol>
            <li>
              Open <Link to="/deploy">Deploy</Link> and connect GitHub or select your source folder.
            </li>
            <li>Enter your project name and an available subdomain.</li>
            <li>
              Set your root directory, build command and output directory, or use automatic
              detection.
            </li>
            <li>Click Deploy to authorize the build and managed-wallet publication.</li>
            <li>
              Watch build stages and logs. Open your project URL when the deployment is Ready.
            </li>
          </ol>
          <Note>
            Once queued, the worker continues even if you close the page. Failed builds retain their
            logs and never replace your current production deployment.
          </Note>
        </section>
        <section id="what-next">
          <h2>What’s next?</h2>
          <div className="docs-next-cards">
            <Link to="/docs" search={{ topic: "github" }}>
              <GitBranch />
              <strong>Deploy from GitHub</strong>
              <span>
                Make your next push a release.
                <ArrowRight size={15} />
              </span>
            </Link>
            <Link to="/docs" search={{ topic: "domains" }}>
              <Globe2 />
              <strong>Make it your own</strong>
              <span>
                Connect a custom domain.
                <ArrowRight size={15} />
              </span>
            </Link>
          </div>
        </section>
      </>
    );
  if (topic === "frameworks")
    return (
      <>
        <section id="supported-output">
          <h2>Supported output</h2>
          <p>
            ShelbyHost serves static HTML, CSS, JavaScript, fonts, and images. Your output must
            contain <code>index.html</code> at its root. Client-side applications can use SPA
            fallback routing.
          </p>
          <Note>
            Server-side rendering, API functions, and edge runtimes are not hosted by ShelbyHost.
            Use a static export and connect your frontend to a separately hosted backend.
          </Note>
        </section>
        <section id="build-settings">
          <h2>Build settings</h2>
          <p>
            These are common output folders; use the output actually produced by your project’s
            build configuration.
          </p>
          <div className="docs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Build command</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Vite / React / Vue", "npm run build", "dist"],
                  ["Astro (static)", "npm run build", "dist"],
                  ["Next.js (static export)", "npm run build", "out"],
                  ["Create React App", "npm run build", "build"],
                  ["Plain HTML / CSS", "No build required", "Folder with index.html"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section id="check-your-output">
          <h2>Check your output</h2>
          <p>
            Check that assets use paths that work at your domain root. Do not include private
            configuration files in your public output. Default validation limits are 2,000 files,
            100 MiB per deployment, and 50 MiB per file; platform configuration can change these
            limits.
          </p>
          <p>
            The generated GitHub workflow checks the configured folder, then <code>dist</code>,{" "}
            <code>build</code>, <code>out</code>, <code>public</code>, and the repository root for
            an index file. Explicitly configure the correct output folder.
          </p>
        </section>
      </>
    );
  if (topic === "wallets")
    return (
      <>
        <section id="sign-in">
          <h2>Sign in</h2>
          <p>
            Dynamic provides authentication through a verified Aptos wallet. Your ShelbyHost
            projects are associated with that Dynamic account.
          </p>
        </section>
        <section id="choose-a-wallet">
          <h2>Choose a wallet</h2>
          <p>
            Connect an Aptos-compatible wallet through Dynamic. Its verified address becomes the
            publishing account for newly created projects.
          </p>
          <p>
            After Shelby stores and verifies a build, your wallet approves the fee and registry
            transactions. ShelbyHost verifies both on chain and never receives your private key.
          </p>
        </section>
        <section id="initial-transactions">
          <h2>Initial transactions</h2>
          <p>
            Initial project creation uses two transactions: a transfer of the configured fee token
            to the treasury, then a registry call containing the project name and content hash. The
            server checks those transactions before creating the project.
          </p>
          <Note>
            The current browser deployment flow uses Aptos Testnet. Fund the wallet that will
            actually sign, and check both gas and fee-token balances. Redeployment endpoints
            currently do not repeat the initial chain verification.
          </Note>
        </section>
      </>
    );
  if (topic === "github")
    return (
      <>
        <section id="connect-repository">
          <h2>Connect a repository</h2>
          <p>
            Create a project, then open its GitHub settings. Select the repository and production
            branch. If the platform’s GitHub App is configured, install it on your repository and
            use Auto-configure with the installation ID.
          </p>
          <p>
            Auto-configure writes a deployment secret and workflow to your repository. The app needs
            permission to write repository contents, workflows, and Actions secrets.
          </p>
        </section>
        <section id="configure-workflow">
          <h2>Configure the workflow</h2>
          <p>
            Use the workflow generated for your project and its configured build command and output
            directory. The default file and secret names are:
          </p>
          <CodeBlock
            label="Repository configuration"
            code={
              "Workflow: .github/workflows/shelbyhost-deploy.yml\nSecret:   SHELBYHOST_DEPLOY_TOKEN"
            }
          />
          <p>
            For manual setup, add the generated token as a repository Actions secret and commit the
            generated YAML. Keep the token private: it authorizes deployments for the connected
            project.
          </p>
        </section>
        <section id="publish-a-change">
          <h2>Publish a change</h2>
          <CodeBlock code={'git add .\ngit commit -m "Ship something new"\ngit push origin main'} />
          <p>
            Replace <code>main</code> with your configured branch. The workflow queues a source
            build. ShelbyHost clones the pinned commit, installs dependencies, builds in isolation,
            validates the output, stores it on Shelby, and publishes the successful version.
          </p>
          <Note>
            Open the project’s Deployments tab to follow real stages and stdout/stderr logs,
            refreshed every few seconds. Failures show their stage and exit code. The current
            production deployment stays active when a new build fails.
          </Note>
        </section>
      </>
    );
  if (topic === "previews")
    return (
      <>
        <section id="enable-previews">
          <h2>Enable previews</h2>
          <p>
            Native pull-request preview builds are not currently supported. Successful source
            deployments receive an immutable version URL, available from the deployment console.
          </p>
          <Note>
            Fork pull requests normally do not receive repository secrets. Because the deploy
            workflow requires the project token, those previews will not finalize automatically. Do
            not expose the token to untrusted code.
          </Note>
        </section>
        <section id="preview-addresses">
          <h2>Preview addresses</h2>
          <CodeBlock
            label="Example preview URL"
            code="https://v-<deployment-id-without-hyphens>.shelbyhost.xyz"
          />
          <p>
            Each successful deployment has a distinct version URL. Its bytes and content hash never
            change; the stable project URL points to the active version.
          </p>
        </section>
        <section id="review-a-build">
          <h2>Review a build</h2>
          <p>
            Open a ready version from the deployment console to inspect it. Select Roll back on a
            previous ready deployment to restore production without rebuilding.
          </p>
        </section>
      </>
    );
  if (topic === "environment")
    return (
      <>
        <section id="add-a-variable">
          <h2>Add a variable</h2>
          <p>
            Open your project’s environment settings. Add a key, value, and target. Keys are
            normalized to uppercase and must use letters, numbers, and underscores, starting with a
            letter or underscore.
          </p>
          <CodeBlock label="Example build variable" code="VITE_API_URL=https://api.example.com" />
        </section>
        <section id="choose-a-target">
          <h2>Choose a target</h2>
          <p>
            Production workflows load production values. Pull-request workflows load preview values.
            Development values can also be stored, but the generated workflow does not select them
            for its production or preview builds.
          </p>
          <p>
            Values are encrypted in the database and returned to an authorized GitHub workflow at
            build time. Listing variables in the UI returns their names and targets, not their
            plaintext values.
          </p>
        </section>
        <section id="build-time-values">
          <h2>Build-time values</h2>
          <Note>
            Variables included in a static frontend bundle are public. Do not place passwords,
            wallet private keys, or service-role credentials in client-exposed variables.
          </Note>
          <p>
            Publish a new build after changing a value. Already-published static files will not
            change automatically.
          </p>
        </section>
      </>
    );
  if (topic === "domains")
    return (
      <>
        <section id="project-subdomain">
          <h2>Project subdomain</h2>
          <p>Each project receives a URL based on its unique slug:</p>
          <CodeBlock label="Example project URL" code="https://your-project.shelbyhost.xyz" />
        </section>
        <section id="connect-domain">
          <h2>Connect your domain</h2>
          <ol>
            <li>Open your project’s domain settings.</li>
            <li>
              Enter a domain you control, such as <code>app.example.com</code>.
            </li>
            <li>Add the DNS record shown by the platform at your DNS provider.</li>
          </ol>
          <p>
            Custom-domain automation currently uses Vercel. The default CNAME target is shown below;
            use the actual target provided by your deployment.
          </p>
          <CodeBlock
            label="Example DNS record"
            code={"Type    Name    Value\nCNAME   app     cname.vercel-dns.com"}
          />
        </section>
        <section id="verify-dns">
          <h2>Verify DNS</h2>
          <p>
            After DNS propagates, select Verify in project settings. A verified mapping routes
            visitors to your project’s current deployment.
          </p>
          <Note>
            The current verifier checks CNAME records. Apex A/ALIAS setups may not verify with this
            implementation; a subdomain CNAME is the supported path described here.
          </Note>
        </section>
      </>
    );
  if (topic === "storage")
    return (
      <>
        <div className="docs-storage-flow">
          <span>
            <UploadCloudIcon />
            Upload
          </span>
          <ArrowRight />
          <span>
            <Layers3 />
            Store
          </span>
          <ArrowRight />
          <span>
            <Globe2 />
            Deliver
          </span>
        </div>
        <section id="upload-staging">
          <h2>Upload staging</h2>
          <p>
            Source is cloned or submitted to an isolated worker. Compiled output is validated before
            leaving the sandbox. The old signed-upload finalization endpoints are disabled.
          </p>
        </section>
        <section id="shelby-mirroring">
          <h2>Shelby artifact storage</h2>
          <p>
            The worker uploads compiled assets and an immutable manifest to Shelby Network. Every
            artifact is read back and checked against its SHA-256 digest before publication.
          </p>
          <p>
            Shelby is required for every new deployment. Upload or verification errors fail the
            release; there is no fallback storage. The default retention is 365 days, configured by
            the operator.
          </p>
        </section>
        <section id="serving-files">
          <h2>Serving files</h2>
          <p>
            The gateway resolves the hostname to the active immutable release, retrieves its Shelby
            asset, verifies its digest, and serves it. Redeployment and rollback keep the same
            project URL.
          </p>
          <Note>
            Content-addressed storage is not a promise of permanent hosting. Availability depends on
            the gateway, configured storage, and retention settings.
          </Note>
        </section>
      </>
    );
  return (
    <>
      <section id="how-hashing-works">
        <h2>How hashing works</h2>
        <p>
          The client sorts files by path, hashes each file’s contents with SHA-256, and combines
          those hashes with their paths. Hashing that combined text produces the deployment
          identifier.
        </p>
        <CodeBlock
          label="Conceptual manifest"
          code={
            "<file-sha256>:/assets/app.js\n<file-sha256>:/index.html\n\nDeployment ID = SHA-256(combined manifest)"
          }
        />
        <p>
          Both file contents and paths contribute to the identifier. It is different from a Git
          commit SHA.
        </p>
      </section>
      <section id="aptos-registration">
        <h2>Aptos registration</h2>
        <p>
          Initial project creation calls the Move registry with the project name and content hash.
          The contract appends a record under the signing account and emits an event with the owner,
          name, hash, and timestamp.
        </p>
      </section>
      <section id="verification-scope">
        <h2>Verification scope</h2>
        <Note>
          The current server validates the submitted hash format and the initial transaction
          payloads. It does not recompute the complete hash from staged files, and the gateway does
          not verify it on every request. Subsequent deployment endpoints do not currently require a
          new registry transaction.
        </Note>
        <p>
          Use a locally recomputed artifact hash when comparing a build to its recorded identifier.
          The registry record describes the initial registration; it is not an independent guarantee
          of the content currently served.
        </p>
      </section>
    </>
  );
}
function UploadCloudIcon() {
  return <FileCode2 />;
}

function Docs() {
  const { topic } = Route.useSearch();
  const current = topics.find((t) => t.id === topic)!;
  const index = topics.indexOf(current);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setNavOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const filtered = topics.filter((t) =>
    `${t.title} ${t.keywords}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="public-site docs-site" id="top">
      <a className="public-skip" href="#docs-article">
        Skip to documentation
      </a>
      <PublicHeader docs />
      <div className="docs-mobile-bar">
        <span>
          <BookOpen size={16} />
          Documentation
        </span>
        <button
          onClick={() => setNavOpen(!navOpen)}
          aria-expanded={navOpen}
          aria-controls="docs-sidebar"
        >
          <List size={17} />
          {navOpen ? "Close guides" : "Browse guides"}
        </button>
      </div>
      <div className="docs-layout public-container">
        <aside className={`docs-sidebar ${navOpen ? "docs-nav-open" : ""}`} id="docs-sidebar">
          <div className="docs-sidebar-heading">
            <BookOpen size={17} />
            <strong>Documentation</strong>
            <span>GUIDES</span>
          </div>
          <label className="docs-search">
            <Search size={15} />
            <input
              ref={searchRef}
              placeholder="Find a guide..."
              aria-label="Search documentation"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X size={14} />
              </button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </label>
          <nav aria-label="Documentation topics">
            {["GET STARTED", "BUILD & DEPLOY", "GO LIVE"].map((group) => {
              const items = filtered.filter((t) => t.group === group);
              return items.length ? (
                <div className="docs-nav-group" key={group}>
                  <h2>{group}</h2>
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      to="/docs"
                      search={{ topic: item.id }}
                      aria-current={topic === item.id ? "page" : undefined}
                      onClick={() => {
                        setNavOpen(false);
                        setQuery("");
                      }}
                    >
                      <item.icon size={16} />
                      {item.title}
                      {topic === item.id && <ChevronRight size={14} />}
                    </Link>
                  ))}
                </div>
              ) : null;
            })}
            {filtered.length === 0 && (
              <p className="docs-no-results" role="status">
                No guides match “{query}”. Try “build”, “domain”, or “wallet”.
              </p>
            )}
          </nav>
          <div className="docs-sidebar-promo">
            <span className="signal-dot" />
            <strong>Ready when you are.</strong>
            <p>Your next idea deserves a URL.</p>
            <DeployButton>Start building</DeployButton>
          </div>
        </aside>
        <main className="docs-article" id="docs-article" key={topic}>
          <div className="docs-breadcrumb">
            <span>Documentation</span>
            <ChevronRight size={12} />
            <span>{current.title}</span>
          </div>
          <span className="eyebrow">{current.group}</span>
          <h1>
            {current.title}
            <span>.</span>
          </h1>
          <p className="docs-description">{current.description}</p>
          <div className="docs-article-meta">
            <span>
              <BookOpen size={13} />
              {topic === "quickstart" ? "5" : "3"} min read
            </span>
            <span>Static deployment guide</span>
          </div>
          <Article topic={topic} />
          <div className="docs-pagination">
            {index > 0 ? (
              <Link to="/docs" search={{ topic: topics[index - 1].id }}>
                <span>
                  <ArrowLeft size={13} />
                  Previous
                </span>
                <strong>{topics[index - 1].title}</strong>
              </Link>
            ) : (
              <div />
            )}
            {index < topics.length - 1 && (
              <Link to="/docs" search={{ topic: topics[index + 1].id }}>
                <span>
                  Up next
                  <ArrowRight size={13} />
                </span>
                <strong>{topics[index + 1].title}</strong>
              </Link>
            )}
          </div>
          <a
            className="docs-source-link"
            href="https://github.com/linoxbt/shelby-deploy-magic"
            target="_blank"
            rel="noreferrer"
          >
            Explore the source on GitHub
            <ArrowUpRight size={14} />
          </a>
        </main>
        <aside className="docs-toc">
          <span>ON THIS PAGE</span>
          <nav aria-label="On this page">
            {headings[topic].map(([id, label]) => (
              <a href={`#${id}`} key={id}>
                {label}
              </a>
            ))}
          </nav>
          <div>
            <p>
              Build something
              <br />
              <strong>worth sharing.</strong>
            </p>
            <Link to="/deploy">
              Open the console
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
      <PublicFooter />
    </div>
  );
}
