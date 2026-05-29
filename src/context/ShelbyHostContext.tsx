import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOAuthTokens, usePrivy } from "@privy-io/react-auth";
import { apiRequest } from "@/lib/api";

export type ProjectStatus = "live" | "processing" | "failed";
export type DeploymentStatus = "queued" | "succeeded" | "failed" | "pending" | "verified";
export type DeploymentTrigger = "manual" | "settings" | "github-push" | "domain" | "hash";
export type Chain = "aptos" | "shelby";

export interface FileEntry {
  name: string;
  size: number;
  type: string;
  path: string;
  file?: File;
}

export interface DeploymentAttempt {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  timestamp: string;
  versionUrl: string;
  hash: string;
  message?: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  files: FileEntry[];
  deployedAt: string | null;
  size: number;
  hash: string;
  status: ProjectStatus;
  source: "drag-drop" | "github";
  framework?: string;
  buildOutput?: string;
  latestVersionUrl?: string;
  chain: Chain;
  walletAddress?: string;
  paymentTxHash?: string;
  registryTxHash?: string;
  domain?: {
    domain: string;
    status: "active" | "pending" | "failed";
    target: string;
    slug: string;
    hash: string;
    kvKey: string;
  };
  github?: {
    account: string;
    repository: string;
    branch: string;
    workflowFile?: string;
    webhookStatus?: "active" | "inactive";
    lastPushAt?: string;
    automationStatus?: "configured" | "manual" | "failed" | string;
    githubInstallationId?: string | null;
  };
  deployments: DeploymentAttempt[];
}

export interface GithubWorkflowSetup {
  deployToken?: string;
  workflowFile: string;
  workflowYaml: string;
  secretName: string;
  automated?: boolean;
  tokenLastFour?: string | null;
}

export type GithubConnectionSetup = GithubWorkflowSetup & {
  connection?: unknown;
  automated?: boolean;
};

export interface GithubAppStatus {
  configured: boolean;
  installUrl: string | null;
}

export interface WalletConnection {
  chain: Chain;
  provider: "petra" | "martian" | "fewcha" | "shelby-vault";
  address: string;
  status: "connected" | "disconnected";
}

export interface BuildCheckResult {
  valid: boolean;
  message: string;
}

interface ShelbyHostContextValue {
  projects: Project[];
  loading: boolean;
  uploadProgress: number | null;
  wallet?: WalletConnection;
  createProject: (data: Partial<Project>) => Promise<Project | null>;
  addProject: (data: Partial<Project>) => Promise<Project | null>;
  deployProject: (projectId: string, files: FileEntry[], message?: string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  updateProject: (
    slug: string,
    updates: Partial<Project>,
    trigger?: DeploymentTrigger,
  ) => Promise<boolean>;
  registerDomain: (slug: string, domain: string) => Promise<boolean>;
  verifyDomain: (slug: string, domain: string) => Promise<boolean>;
  connectWallet: (
    chain: Chain,
    address: string,
    provider: string,
  ) => Promise<WalletConnection | null>;
  connectGithub: (
    slug: string,
    githubData: Project["github"],
  ) => Promise<GithubConnectionSetup | null>;
  triggerGithubDeploy: (slug: string) => Promise<boolean>;
  getGithubWorkflow: (slug: string) => Promise<GithubWorkflowSetup | null>;
  rotateGithubDeployToken: (slug: string) => Promise<GithubWorkflowSetup | null>;
  getGithubAppStatus: () => Promise<GithubAppStatus | null>;
  setupGithubApp: (
    slug: string,
    githubData: Project["github"] & { installationId?: string | number },
  ) => Promise<GithubConnectionSetup | null>;
  fetchGithubRepos: () => Promise<any[]>;
  linkGithub: () => Promise<void>;
  generateHash: (files: FileEntry[]) => Promise<string>;
  generateSlug: (name: string) => string;
  checkBuildOutput: (files: FileEntry[], buildOutput?: string) => BuildCheckResult;
}

const ShelbyHostContext = createContext<ShelbyHostContextValue | null>(null);

const now = () => new Date().toISOString();
const versionUrl = (hash: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/shelby_nodes/${hash}/index.html`;
const baseDomain = import.meta.env.VITE_SHELBY_BASE_DOMAIN || "shelbyhost.xyz";
export const projectPublicUrl = (slug: string) => `https://${slug}.${baseDomain}`;

const MIME_MAP: Record<string, string> = {
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain",
  xml: "application/xml",
};

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? "application/octet-stream";
}

async function uploadFilesToStorage(
  hash: string,
  files: FileEntry[],
  buildOutput: string,
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const realFiles = files.filter((f) => f.file);
  if (realFiles.length === 0) return versionUrl(hash);

  const { files: uploadFiles } = await apiFetch<{
    files: Array<FileEntry & { storagePath: string; token: string }>;
  }>("/api/storage/upload-urls", {
    method: "POST",
    body: JSON.stringify({
      hash,
      buildOutput,
      files: realFiles.map(({ file, ...entry }) => entry),
    }),
  });

  const uploadByPath = new Map(uploadFiles.map((entry) => [entry.path, entry]));
  let uploaded = 0;

  for (const entry of realFiles) {
    const upload = uploadByPath.get(normalizeDeployPath(entry.path, buildOutput));
    if (!upload) throw new Error(`Missing signed upload URL for ${entry.name}`);

    const contentType = entry.file!.type || getMimeType(entry.name);

    const { error } = await supabase.storage
      .from("shelby_nodes")
      .uploadToSignedUrl(upload.storagePath, upload.token, entry.file!, { contentType });

    if (error) {
      console.error(`Upload failed for ${upload.storagePath}:`, error);
      throw new Error(`Failed to upload ${entry.name}: ${error.message}`);
    }

    uploaded++;
    onProgress?.(Math.round((uploaded / realFiles.length) * 100));
  }

  return versionUrl(hash);
}

function normalizeDeployPath(path: string, buildOutput = "dist") {
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;
  const output = buildOutput.replace(/^\/+|\/+$/g, "");
  const prefix = `/${output}/`;
  return normalizedPath.startsWith(prefix)
    ? `/${normalizedPath.slice(prefix.length)}`
    : normalizedPath;
}

function normalizeFiles(files: FileEntry[], buildOutput = "dist"): FileEntry[] {
  return files.map((file) => ({
    ...file,
    path: normalizeDeployPath(file.path, buildOutput),
  }));
}

const generateRealHash = async (files: FileEntry[]) => {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  let combinedHashData = "";

  for (const file of sortedFiles) {
    let fileHash = "";
    if (file.file) {
      const buffer = await file.file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } else {
      fileHash = `mock-${file.size}-${file.name}`;
    }
    combinedHashData += `${fileHash}:${file.path}\n`;
  }

  const encoder = new TextEncoder();
  const finalBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(combinedHashData));
  const finalArray = Array.from(new Uint8Array(finalBuffer));
  return finalArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function ShelbyHostProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [wallet, setWallet] = useState<WalletConnection | undefined>();
  const { user, authenticated, ready, linkGithub: privyLinkGithub, getAccessToken } = usePrivy();

  const apiFetch = useCallback(
    async <T,>(path: string, options: Parameters<typeof apiRequest<T>>[1] = {}) =>
      apiRequest<T>(path, options, getAccessToken),
    [getAccessToken],
  );

  const { reauthorize: reauthorizeGithub } = useOAuthTokens({
    onOAuthTokenGrant: async ({ oAuthTokens }) => {
      if (oAuthTokens.provider !== "github") return;
      try {
        await apiFetch("/api/github/account", {
          method: "POST",
          body: {
            accessToken: oAuthTokens.accessToken,
            scopes: oAuthTokens.scopes || [],
          },
        });
        toast.success("GitHub account connected");
      } catch (error) {
        console.error("Failed to save GitHub token:", error);
        toast.error("GitHub connected, but token storage failed");
      }
    },
  });

  const fetchProjects = useCallback(async () => {
    try {
      if (!authenticated || !user) {
        setProjects([]);
        setWallet(undefined);
        return;
      }

      const { projects: data, wallet: walletRow } = await apiFetch<{
        projects: any[];
        wallet: any | null;
      }>("/api/projects");

      const mappedProjects: Project[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        files: (p.files || []) as FileEntry[],
        deployedAt: p.deployed_at,
        size: p.size_bytes || 0,
        hash: p.content_hash || "",
        status: p.status as ProjectStatus,
        source: (p.source || "drag-drop") as "drag-drop" | "github",
        framework: p.framework,
        buildOutput: p.build_output,
        latestVersionUrl: projectPublicUrl(p.slug),
        chain: (p.chain || "aptos") as Chain,
        walletAddress: p.wallet_address,
        domain: p.shelby_domain_mappings?.[0]
          ? {
              domain: p.shelby_domain_mappings[0].domain,
              status: p.shelby_domain_mappings[0].status as any,
              target: p.shelby_domain_mappings[0].target,
              slug: p.shelby_domain_mappings[0].slug,
              hash: p.shelby_domain_mappings[0].content_hash,
              kvKey: p.shelby_domain_mappings[0].kv_key,
            }
          : undefined,
        github: p.shelby_github_connections?.[0]
          ? {
              account: p.shelby_github_connections[0].account,
              repository: p.shelby_github_connections[0].repository,
              branch: p.shelby_github_connections[0].branch,
              workflowFile: p.shelby_github_connections[0].workflow_file,
              webhookStatus: p.shelby_github_connections[0].webhook_status as any,
              lastPushAt: p.shelby_github_connections[0].last_push_at,
              automationStatus: p.shelby_github_connections[0].automation_status,
              githubInstallationId: p.shelby_github_connections[0].github_installation_id,
            }
          : undefined,
        deployments: (p.shelby_deployments || [])
          .map((d: any) => ({
            id: d.id,
            projectId: d.project_id,
            status: d.status as DeploymentStatus,
            trigger: d.trigger as DeploymentTrigger,
            timestamp: d.created_at,
            versionUrl: d.version_url,
            hash: d.content_hash,
            message: d.message,
          }))
          .sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          ),
      }));

      setProjects(mappedProjects);
      setWallet(
        walletRow
          ? {
              chain: walletRow.chain,
              provider: walletRow.wallet_provider,
              address: walletRow.address,
              status: walletRow.status,
            }
          : undefined,
      );
    } catch (error: any) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, authenticated, user]);

  useEffect(() => {
    if (ready) {
      fetchProjects();
    }
  }, [fetchProjects, ready]);

  const value = useMemo(() => {
    const createProject = async (projectData: Partial<Project>) => {
      try {
        const slug =
          projectData.slug ||
          projectData.name?.toLowerCase().replace(/[^a-z0-9]/g, "-") ||
          "project";

        const files = projectData.files ?? [];
        const size = projectData.size ?? files.reduce((s, f) => s + f.size, 0);

        // 1. Generate hash
        const hash = projectData.hash || (await generateRealHash(files));

        // 2. Upload real files to Supabase Storage
        let latestVersionUrl = projectData.latestVersionUrl || "";
        const realFiles = files.filter((f) => f.file);
        if (realFiles.length > 0) {
          toast.info("Uploading files to storage…");
          setUploadProgress(0);
          latestVersionUrl = await uploadFilesToStorage(
            hash,
            files,
            projectData.buildOutput ?? "dist",
            apiFetch,
            (pct) => setUploadProgress(pct),
          );
          setUploadProgress(null);
        } else if (!latestVersionUrl) {
          latestVersionUrl = versionUrl(hash);
        }

        const { project: data } = await apiFetch<{ project: any }>("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            name: projectData.name!,
            slug,
            description: projectData.description ?? "",
            source: projectData.source || "drag-drop",
            chain: projectData.chain || "aptos",
            walletAddress: projectData.walletAddress ?? null,
            framework: projectData.framework ?? "vite",
            buildOutput: projectData.buildOutput ?? "dist",
            hash,
            size,
            files: files.map(({ file, ...entry }) => entry),
            message: "Initial deployment",
            paymentTxHash: projectData.paymentTxHash,
            registryTxHash: projectData.registryTxHash,
          }),
        });

        const newProject: Project = {
          ...projectData,
          id: data.id,
          slug: data.slug,
          hash,
          status: "live",
          latestVersionUrl: projectPublicUrl(data.slug),
          deployments: [],
          files: normalizeFiles(files, projectData.buildOutput ?? "dist"),
          deployedAt: data.deployed_at,
          size,
          chain: data.chain as Chain,
        } as Project;

        setProjects((prev) => [newProject, ...prev]);
        toast.success("Project deployed successfully!");
        return newProject;
      } catch (error: any) {
        console.error("Error creating project:", error);
        setUploadProgress(null);
        toast.error(`Deployment failed: ${error.message}`);
        return null;
      }
    };

    return {
      projects,
      loading,
      uploadProgress,
      wallet,
      createProject,
      addProject: createProject,
      deployProject: async (projectId: string, files: FileEntry[], message?: string) => {
        try {
          toast.info("Starting deployment…");
          const project = projects.find((p) => p.id === projectId);
          if (!project) return false;

          const deployFiles = normalizeFiles(files, project.buildOutput ?? "dist");
          const hash = await generateRealHash(deployFiles);

          // Upload files
          setUploadProgress(0);
          const vUrl = await uploadFilesToStorage(
            hash,
            files,
            project.buildOutput ?? "dist",
            apiFetch,
            (pct) => setUploadProgress(pct),
          );
          setUploadProgress(null);

          await apiFetch(`/api/projects/${project.slug}/deployments`, {
            method: "POST",
            body: JSON.stringify({
              hash,
              files: files.map(({ file, ...entry }) => entry),
              buildOutput: project.buildOutput,
              message: message || "Manual re-deployment",
            }),
          });

          await fetchProjects();
          toast.success("Deployment successful!");
          return true;
        } catch (error: any) {
          console.error("Deployment error:", error);
          setUploadProgress(null);
          toast.error(`Deployment failed: ${error.message}`);
          return false;
        }
      },
      deleteProject: async (slug: string) => {
        try {
          await apiFetch(`/api/projects/${slug}`, { method: "DELETE" });
          setProjects((prev) => prev.filter((p) => p.slug !== slug));
          toast.success("Project deleted");
          return true;
        } catch (error: any) {
          console.error("Delete error:", error);
          toast.error("Failed to delete project");
          return false;
        }
      },
      updateProject: async (
        slug: string,
        updates: Partial<Project>,
        trigger: DeploymentTrigger = "settings",
      ) => {
        try {
          await apiFetch(`/api/projects/${slug}`, {
            method: "PATCH",
            body: JSON.stringify({
              framework: updates.framework,
              buildOutput: updates.buildOutput,
            }),
          });
          await fetchProjects();
          toast.success("Project updated");
          return true;
        } catch (error: any) {
          console.error("Update error:", error);
          toast.error("Failed to update project");
          return false;
        }
      },
      registerDomain: async (slug: string, domain: string) => {
        try {
          const project = projects.find((p) => p.slug === slug);
          if (!project) return false;

          await apiFetch("/api/domains", {
            method: "POST",
            body: JSON.stringify({ slug: project.slug, domain }),
          });
          await fetchProjects();
          toast.success("Domain registration initiated");
          return true;
        } catch (error: any) {
          console.error("Domain error:", error);
          toast.error("Failed to register domain");
          return false;
        }
      },
      verifyDomain: async (slug: string, domain: string) => {
        try {
          toast.info(`Verifying DNS for ${domain}…`);
          const data = await apiFetch<any>("/api/domains", {
            method: "PATCH",
            body: JSON.stringify({ slug, domain }),
          });

          if (data?.verified) {
            toast.success("Domain verified!");
            await fetchProjects();
            return true;
          } else {
            toast.error(data?.message || "Verification failed. Check your DNS records.");
            return false;
          }
        } catch (error: any) {
          console.error("Verification error:", error);
          toast.error("Domain verification failed");
          return false;
        }
      },
      connectWallet: async (chain: Chain, address: string, provider: string) => {
        try {
          const { wallet: data } = await apiFetch<{ wallet: any }>("/api/wallets", {
            method: "POST",
            body: JSON.stringify({ chain, address, provider }),
          });

          const next: WalletConnection = {
            chain: data.chain as Chain,
            provider: data.wallet_provider as any,
            address: data.address,
            status: "connected",
          };

          setWallet(next);
          toast.success(`Wallet connected: ${chain}`);
          return next;
        } catch (error: any) {
          console.error("Error connecting wallet:", error);
          toast.error("Wallet connection failed");
          return null;
        }
      },
      connectGithub: async (slug: string, githubData: Project["github"]) => {
        try {
          const project = projects.find((p) => p.slug === slug);
          if (!project) return null;

          const setup = await apiFetch<GithubConnectionSetup>("/api/github/connect", {
            method: "POST",
            body: JSON.stringify({
              slug: project.slug,
              account: githubData?.account ?? "",
              repository: githubData?.repository ?? "",
              branch: githubData?.branch ?? "main",
              workflowFile: githubData?.workflowFile,
            }),
          });
          await fetchProjects();
          toast.success("GitHub connected. Add the deploy secret and workflow to the repo.");
          return setup;
        } catch (error: any) {
          console.error("GitHub connection error:", error);
          toast.error("Failed to connect GitHub");
          return null;
        }
      },
      getGithubAppStatus: async () => {
        try {
          return await apiFetch<GithubAppStatus>("/api/github/app/setup");
        } catch (error: any) {
          toast.error(error.message || "Failed to load GitHub App status");
          return null;
        }
      },
      setupGithubApp: async (
        slug: string,
        githubData: Project["github"] & { installationId?: string | number },
      ) => {
        try {
          const project = projects.find((p) => p.slug === slug);
          if (!project) return null;

          const setup = await apiFetch<GithubConnectionSetup>("/api/github/app/setup", {
            method: "POST",
            body: {
              slug: project.slug,
              installationId: githubData?.installationId,
              account: githubData?.account ?? "",
              repository: githubData?.repository ?? "",
              branch: githubData?.branch ?? "main",
              workflowFile: githubData?.workflowFile,
              buildOutput: project.buildOutput ?? "dist",
            },
          });
          await fetchProjects();
          toast.success("GitHub App configured the deploy secret and workflow.");
          return setup;
        } catch (error: any) {
          console.error("GitHub App setup error:", error);
          toast.error(error.message || "Failed to configure GitHub App");
          return null;
        }
      },
      triggerGithubDeploy: async (slug: string) => {
        try {
          await apiFetch("/api/github/trigger", {
            method: "POST",
            body: JSON.stringify({ slug }),
          });
          toast.success("GitHub Actions workflow triggered");
          return true;
        } catch (error: any) {
          toast.error(error.message || "Failed to trigger GitHub workflow");
          return false;
        }
      },
      getGithubWorkflow: async (slug: string) => {
        try {
          return await apiFetch<GithubWorkflowSetup>(
            `/api/github/workflow?slug=${encodeURIComponent(slug)}`,
          );
        } catch (error: any) {
          toast.error(error.message || "Failed to load GitHub workflow setup");
          return null;
        }
      },
      rotateGithubDeployToken: async (slug: string) => {
        try {
          const setup = await apiFetch<GithubWorkflowSetup>("/api/github/workflow", {
            method: "POST",
            body: { slug, rotateToken: true },
          });
          toast.success("Generated a new GitHub deploy token");
          return setup;
        } catch (error: any) {
          toast.error(error.message || "Failed to rotate GitHub deploy token");
          return null;
        }
      },
      linkGithub: async () => {
        try {
          await privyLinkGithub();
          await reauthorizeGithub({ provider: "github" });
        } catch (error) {
          console.error("Privy GitHub link error:", error);
        }
      },
      fetchGithubRepos: async () => {
        // Look up linked GitHub account in Privy user
        const githubAccount = user?.linkedAccounts?.find(
          (acc: any) => acc.type === "github_oauth",
        ) as any;

        try {
          // Call the edge function proxy to avoid CORS + token exposure
          const data = await apiFetch<any>("/api/github/repos");
          if ((!data?.repos || data.repos.length === 0) && githubAccount) {
            toast.info("Authorize GitHub repository access to import repos.");
            await reauthorizeGithub({ provider: "github" });
            const refreshed = await apiFetch<any>("/api/github/repos");
            return refreshed?.repos ?? [];
          }
          return data?.repos ?? [];
        } catch (err) {
          console.error("Failed to fetch GitHub repos:", err);
          return [];
        }
      },
      generateHash: generateRealHash,
      generateSlug: (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      checkBuildOutput: (files: FileEntry[], buildOutput = "dist"): BuildCheckResult => {
        const hasIndex = files.some(
          (f) =>
            f.path === `/${buildOutput}/index.html` ||
            f.path === `/index.html` ||
            f.name === "index.html",
        );
        if (hasIndex) {
          return {
            valid: true,
            message: `✓ Found index.html in ${buildOutput}/ — ready to deploy.`,
          };
        }
        return {
          valid: false,
          message: `✗ No index.html found in ${buildOutput}/. Run your build command first (e.g. npm run build).`,
        };
      },
    };
  }, [
    projects,
    loading,
    uploadProgress,
    wallet,
    user,
    apiFetch,
    fetchProjects,
    privyLinkGithub,
    reauthorizeGithub,
  ]);

  return <ShelbyHostContext.Provider value={value}>{children}</ShelbyHostContext.Provider>;
}

export function useShelbyHost() {
  const context = useContext(ShelbyHostContext);
  if (!context) throw new Error("useShelbyHost must be used within ShelbyHostProvider");
  return context;
}
