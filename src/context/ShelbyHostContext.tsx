import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ProjectStatus = "live" | "processing" | "failed";
export type DeploymentStatus = "queued" | "succeeded" | "failed";
export type DeploymentTrigger = "manual" | "settings" | "github-push" | "domain" | "hash";
export type Chain = "aptos" | "shelby";

export interface FileEntry {
  name: string;
  size: number;
  type: string;
  path: string;
}

export interface DeploymentAttempt {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  timestamp: string;
  versionUrl: string;
  hash: string;
  message: string;
}

export interface CustomDomain {
  domain: string;
  status: "verified" | "pending" | "failed";
  target: string;
  slug: string;
  hash: string;
  kvKey: string;
}

export interface GithubConnection {
  account: string;
  repository: string;
  branch: string;
  workflowFile: string;
  webhookStatus: "active" | "paused" | "failed";
  lastPushAt?: string;
}

export interface WalletConnection {
  chain: Chain;
  provider: "Petra" | "Martian" | "Shelby Wallet";
  address: string;
  status: "connected" | "disconnected";
}

export interface BuildCheck {
  valid: boolean;
  expectedFile: string;
  message: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  files: FileEntry[];
  deployedAt: string;
  size: number;
  hash: string;
  status: ProjectStatus;
  source: "drag-drop" | "github";
  framework: string;
  buildOutput: string;
  latestVersionUrl: string;
  chain: Chain;
  walletAddress?: string;
  domain?: CustomDomain;
  github?: GithubConnection;
  deployments: DeploymentAttempt[];
}

interface ShelbyHostContextValue {
  projects: Project[];
  wallet?: WalletConnection;
  domainMappings: CustomDomain[];
  addProject: (project: Omit<Project, "id" | "deployedAt" | "status" | "deployments" | "latestVersionUrl">) => Project;
  updateProject: (slug: string, patch: Partial<Project>, trigger?: DeploymentTrigger) => void;
  deleteProject: (slug: string) => void;
  registerDomain: (slug: string, domain: string) => void;
  connectGithub: (slug: string, connection: Omit<GithubConnection, "workflowFile" | "webhookStatus" | "lastPushAt">) => void;
  triggerGithubDeploy: (slug: string) => void;
  connectWallet: (chain?: Chain) => WalletConnection;
  checkBuildOutput: (files: FileEntry[], buildOutput: string) => BuildCheck;
  generateSlug: (name: string) => string;
  generateHash: () => string;
}

const ShelbyHostContext = createContext<ShelbyHostContextValue | null>(null);

const STORAGE_KEY = "shelbyhost-projects-v2";
const WALLET_KEY = "shelbyhost-wallet-v1";
const TARGET_HOST = "shelbyhost.pages.dev";

const now = () => new Date().toISOString();
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const makeHash = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const versionUrl = (slug: string, hash: string) => `https://${TARGET_HOST}/p/${slug}?v=${hash.slice(0, 8)}`;

function makeDeployment(projectId: string, slug: string, hash: string, status: DeploymentStatus, trigger: DeploymentTrigger, message: string): DeploymentAttempt {
  return { id: makeId(), projectId, status, trigger, timestamp: now(), versionUrl: versionUrl(slug, hash), hash, message };
}

const seedProjects: Project[] = [
  {
    id: "seed-lunex",
    name: "Lunex Finance",
    slug: "lunex-finance",
    description: "A static DeFi analytics frontend stored on Shelby hot storage.",
    files: [
      { name: "dist/index.html", size: 18240, type: "HTML", path: "/dist/index.html" },
      { name: "dist/assets/app.css", size: 34880, type: "CSS", path: "/dist/assets/app.css" },
      { name: "dist/assets/main.js", size: 244120, type: "JS", path: "/dist/assets/main.js" },
    ],
    deployedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    size: 297240,
    hash: "a3f721bc9e04d15f7c8ab2e091634d72",
    status: "live",
    source: "github",
    framework: "vite",
    buildOutput: "dist",
    latestVersionUrl: versionUrl("lunex-finance", "a3f721bc9e04d15f7c8ab2e091634d72"),
    chain: "aptos",
    walletAddress: "0x7e5b1a2c9f4d88a0",
    github: { account: "shelby-labs", repository: "lunex-finance", branch: "main", workflowFile: ".github/workflows/shelbyhost-deploy.yml", webhookStatus: "active", lastPushAt: new Date(Date.now() - 1000 * 60 * 38).toISOString() },
    domain: { domain: "myproject.com", status: "verified", target: TARGET_HOST, slug: "lunex-finance", hash: "a3f721bc9e04d15f7c8ab2e091634d72", kvKey: "host:myproject.com" },
    deployments: [{ id: "seed-lunex-deploy-1", projectId: "seed-lunex", status: "succeeded", trigger: "github-push", timestamp: new Date(Date.now() - 1000 * 60 * 38).toISOString(), versionUrl: versionUrl("lunex-finance", "a3f721bc9e04d15f7c8ab2e091634d72"), hash: "a3f721bc9e04d15f7c8ab2e091634d72", message: "GitHub Action uploaded dist and registered the Aptos hash." }],
  },
  {
    id: "seed-aurumx",
    name: "AurumX Landing",
    slug: "aurumx-landing",
    description: "Marketing page deployed from a pre-built output folder.",
    files: [
      { name: "out/index.html", size: 14960, type: "HTML", path: "/out/index.html" },
      { name: "out/assets/hero.webp", size: 491520, type: "Image", path: "/out/assets/hero.webp" },
    ],
    deployedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    size: 506480,
    hash: "b91c334e6ad7f409cc8a22e18a7d924f",
    status: "live",
    source: "drag-drop",
    framework: "next-static",
    buildOutput: "out",
    latestVersionUrl: versionUrl("aurumx-landing", "b91c334e6ad7f409cc8a22e18a7d924f"),
    chain: "aptos",
    domain: { domain: "app.aurumx.io", status: "pending", target: TARGET_HOST, slug: "aurumx-landing", hash: "b91c334e6ad7f409cc8a22e18a7d924f", kvKey: "host:app.aurumx.io" },
    deployments: [{ id: "seed-aurumx-deploy-1", projectId: "seed-aurumx", status: "succeeded", trigger: "manual", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), versionUrl: versionUrl("aurumx-landing", "b91c334e6ad7f409cc8a22e18a7d924f"), hash: "b91c334e6ad7f409cc8a22e18a7d924f", message: "Build output check passed and the site went live." }],
  },
];

export function ShelbyHostProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [wallet, setWallet] = useState<WalletConnection | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedWallet = window.localStorage.getItem(WALLET_KEY);
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch {
        setProjects(seedProjects);
      }
    }
    if (savedWallet) {
      try {
        setWallet(JSON.parse(savedWallet));
      } catch {
        setWallet(undefined);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (typeof window === "undefined" || !wallet) return;
    window.localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
  }, [wallet]);

  const value = useMemo<ShelbyHostContextValue>(() => {
    const generateSlug = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "untitled-project";

    const checkBuildOutput = (files: FileEntry[], buildOutput: string): BuildCheck => {
      const cleanOutput = buildOutput.replace(/^\/+|\/+$/g, "") || ".";
      const expectedFile = cleanOutput === "." ? "/index.html" : `/${cleanOutput}/index.html`;
      const valid = files.some((file) => file.path === expectedFile || file.name === expectedFile.slice(1));
      return {
        valid,
        expectedFile,
        message: valid ? `${expectedFile} found. Deployment can be published.` : `Missing ${expectedFile}. Upload the compiled build output before publishing.`,
      };
    };

    const queueRedeploy = (slug: string, trigger: DeploymentTrigger, patch: Partial<Project> = {}) => {
      setProjects((current) =>
        current.map((project) => {
          if (project.slug !== slug) return project;
          const nextHash = trigger === "hash" && patch.hash ? patch.hash : makeHash();
          const output = patch.buildOutput ?? project.buildOutput;
          const files = patch.files ?? project.files;
          const check = checkBuildOutput(files, output);
          const queued = makeDeployment(project.id, project.slug, nextHash, "queued", trigger, trigger === "github-push" ? "Push received from ShelbyHost GitHub Action." : "Project settings changed. Automatic redeploy queued.");
          return { ...project, ...patch, hash: nextHash, latestVersionUrl: versionUrl(project.slug, nextHash), status: check.valid ? "processing" : "failed", deployments: [queued, ...project.deployments] };
        }),
      );

      window.setTimeout(() => {
        setProjects((current) =>
          current.map((project) => {
            if (project.slug !== slug) return project;
            const check = checkBuildOutput(project.files, project.buildOutput);
            const finalStatus: DeploymentStatus = check.valid ? "succeeded" : "failed";
            const done = makeDeployment(project.id, project.slug, project.hash, finalStatus, trigger, check.valid ? "Redeploy completed and latest version URL updated." : check.message);
            return {
              ...project,
              status: check.valid ? "live" : "failed",
              deployedAt: check.valid ? now() : project.deployedAt,
              domain: project.domain ? { ...project.domain, slug: project.slug, hash: project.hash } : undefined,
              deployments: [done, ...project.deployments],
            };
          }),
        );
      }, 1400);
    };

    return {
      projects,
      wallet,
      domainMappings: projects.flatMap((project) => (project.domain ? [project.domain] : [])),
      generateSlug,
      generateHash: makeHash,
      checkBuildOutput,
      addProject: (project) => {
        const check = checkBuildOutput(project.files, project.buildOutput);
        const id = makeId();
        const latestVersionUrl = versionUrl(project.slug, project.hash);
        const firstDeployment = makeDeployment(id, project.slug, project.hash, check.valid ? "succeeded" : "failed", "manual", check.valid ? "Build output check passed and the deployment is live." : check.message);
        const next: Project = {
          ...project,
          id,
          latestVersionUrl,
          deployedAt: now(),
          status: check.valid ? "live" : "failed",
          deployments: [firstDeployment],
        };
        setProjects((current) => [next, ...current.filter((item) => item.slug !== next.slug)]);
        return next;
      },
      updateProject: (slug, patch, trigger = "settings") => queueRedeploy(slug, trigger, patch),
      deleteProject: (slug) => setProjects((current) => current.filter((item) => item.slug !== slug)),
      registerDomain: (slug, domain) => {
        const normalized = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
        setProjects((current) =>
          current.map((project) =>
            project.slug === slug
              ? { ...project, domain: { domain: normalized, status: "verified", target: TARGET_HOST, slug: project.slug, hash: project.hash, kvKey: `host:${normalized}` } }
              : project,
          ),
        );
        queueRedeploy(slug, "domain");
      },
      connectGithub: (slug, connection) => {
        setProjects((current) =>
          current.map((project) =>
            project.slug === slug
              ? { ...project, source: "github", github: { ...connection, workflowFile: ".github/workflows/shelbyhost-deploy.yml", webhookStatus: "active", lastPushAt: now() } }
              : project,
          ),
        );
        queueRedeploy(slug, "github-push");
      },
      triggerGithubDeploy: (slug) => queueRedeploy(slug, "github-push"),
      connectWallet: (chain = "aptos") => {
        const next: WalletConnection = { chain, provider: chain === "aptos" ? "Petra" : "Shelby Wallet", address: chain === "aptos" ? "0x7e5b1a2c9f4d88a0" : "shelby1q9x7k2m4n8", status: "connected" };
        setWallet(next);
        setProjects((current) => current.map((project) => ({ ...project, chain, walletAddress: next.address })));
        return next;
      },
    };
  }, [projects, wallet]);

  return <ShelbyHostContext.Provider value={value}>{children}</ShelbyHostContext.Provider>;
}

export function useShelbyHost() {
  const context = useContext(ShelbyHostContext);
  if (!context) throw new Error("useShelbyHost must be used within ShelbyHostProvider");
  return context;
}
