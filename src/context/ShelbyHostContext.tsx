import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";

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
  domain?: {
    domain: string;
    status: "active" | "pending" | "error";
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
  };
  deployments: DeploymentAttempt[];
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
  updateProject: (slug: string, updates: Partial<Project>, trigger?: DeploymentTrigger) => Promise<boolean>;
  registerDomain: (slug: string, domain: string) => Promise<boolean>;
  verifyDomain: (slug: string, domain: string) => Promise<boolean>;
  connectWallet: (chain: Chain, address: string, provider: string) => Promise<WalletConnection | null>;
  connectGithub: (slug: string, githubData: Project["github"]) => Promise<boolean>;
  triggerGithubDeploy: (slug: string) => Promise<boolean>;
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
  onProgress?: (pct: number) => void
): Promise<string> {
  const realFiles = files.filter((f) => f.file);
  let uploaded = 0;

  for (const entry of realFiles) {
    const storagePath = `${hash}${entry.path}`;
    const contentType = entry.file!.type || getMimeType(entry.name);

    const { error } = await supabase.storage
      .from("shelby_nodes")
      .upload(storagePath, entry.file!, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(`Upload failed for ${storagePath}:`, error);
      throw new Error(`Failed to upload ${entry.name}: ${error.message}`);
    }

    uploaded++;
    onProgress?.(Math.round((uploaded / realFiles.length) * 100));
  }

  return versionUrl(hash);
}

const generateRealHash = async (files: FileEntry[]) => {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  let combinedHashData = "";

  for (const file of sortedFiles) {
    let fileHash = "";
    if (file.file) {
      const buffer = await file.file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      fileHash = `mock-${file.size}-${file.name}`;
    }
    combinedHashData += `${fileHash}:${file.path}\n`;
  }

  const encoder = new TextEncoder();
  const finalBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(combinedHashData));
  const finalArray = Array.from(new Uint8Array(finalBuffer));
  return finalArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export function ShelbyHostProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [wallet, setWallet] = useState<WalletConnection | undefined>();
  const { user, authenticated, ready, linkGithub: privyLinkGithub } = usePrivy();

  const fetchProjects = async () => {
    try {
      if (!authenticated || !user) {
        setProjects([]);
        setWallet(undefined);
        return;
      }

      const { data, error } = await supabase
        .from("shelby_projects")
        .select(`
          *,
          shelby_deployments (*),
          shelby_domain_mappings (*),
          shelby_github_connections (*),
          shelby_wallet_connections (*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

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
        latestVersionUrl: p.latest_version_url,
        chain: (p.chain || "aptos") as Chain,
        walletAddress: p.wallet_address,
        domain: p.shelby_domain_mappings?.[0] ? {
          domain: p.shelby_domain_mappings[0].domain,
          status: p.shelby_domain_mappings[0].status as any,
          target: p.shelby_domain_mappings[0].target,
          slug: p.shelby_domain_mappings[0].slug,
          hash: p.shelby_domain_mappings[0].content_hash,
          kvKey: p.shelby_domain_mappings[0].kv_key,
        } : undefined,
        github: p.shelby_github_connections?.[0] ? {
          account: p.shelby_github_connections[0].account,
          repository: p.shelby_github_connections[0].repository,
          branch: p.shelby_github_connections[0].branch,
          workflowFile: p.shelby_github_connections[0].workflow_file,
          webhookStatus: p.shelby_github_connections[0].webhook_status as any,
          lastPushAt: p.shelby_github_connections[0].last_push_at,
        } : undefined,
        deployments: (p.shelby_deployments || []).map((d: any) => ({
          id: d.id,
          projectId: d.project_id,
          status: d.status as DeploymentStatus,
          trigger: d.trigger as DeploymentTrigger,
          timestamp: d.created_at,
          versionUrl: d.version_url,
          hash: d.content_hash,
          message: d.message,
        })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      }));

      setProjects(mappedProjects);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) {
      fetchProjects();
    }
  }, [authenticated, user, ready]);

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
          latestVersionUrl = await uploadFilesToStorage(hash, files, (pct) =>
            setUploadProgress(pct)
          );
          setUploadProgress(null);
        } else if (!latestVersionUrl) {
          latestVersionUrl = versionUrl(hash);
        }

        // 3. Insert project row (owner_id set by DB via auth.uid())
        const { data, error } = await supabase
          .from("shelby_projects")
          .insert({
            name: projectData.name!,
            slug,
            description: projectData.description ?? "",
            status: "live",
            source: (projectData.source || "drag-drop") as "drag-drop" | "github",
            chain: (projectData.chain || "aptos") as "aptos" | "shelby",
            wallet_address: projectData.walletAddress ?? null,
            framework: projectData.framework ?? "vite",
            build_output: projectData.buildOutput ?? "dist",
            content_hash: hash,
            latest_version_url: latestVersionUrl,
            size_bytes: size,
            files: files.map((f) => ({ name: f.name, size: f.size, type: f.type, path: f.path })) as any,
            deployed_at: now(),
          })
          .select()
          .single();

        if (error) throw error;

        // 4. Record first deployment
        await supabase.from("shelby_deployments").insert({
          project_id: data.id,
          content_hash: hash,
          version_url: latestVersionUrl,
          status: "succeeded",
          trigger: "manual",
          message: "Initial deployment",
        });

        const newProject: Project = {
          ...projectData,
          id: data.id,
          slug: data.slug,
          hash,
          status: "live",
          latestVersionUrl,
          deployments: [],
          files,
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

          const hash = await generateRealHash(files);
          const totalSize = files.reduce((sum, f) => sum + f.size, 0);

          // Upload files
          setUploadProgress(0);
          const vUrl = await uploadFilesToStorage(hash, files, (pct) =>
            setUploadProgress(pct)
          );
          setUploadProgress(null);

          const { error: dError } = await supabase.from("shelby_deployments").insert({
            project_id: projectId,
            content_hash: hash,
            version_url: vUrl,
            status: "succeeded",
            trigger: "manual",
            message: message || "Manual re-deployment",
          });
          if (dError) throw dError;

          const { error: pError } = await supabase
            .from("shelby_projects")
            .update({
              content_hash: hash,
              latest_version_url: vUrl,
              deployed_at: now(),
              size_bytes: totalSize,
              status: "live",
              files: files.map((f) => ({ name: f.name, size: f.size, type: f.type, path: f.path })) as any,
            })
            .eq("id", projectId);
          if (pError) throw pError;

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
          const { error } = await supabase
            .from("shelby_projects")
            .delete()
            .eq("slug", slug);

          if (error) throw error;
          setProjects(prev => prev.filter(p => p.slug !== slug));
          toast.success("Project deleted");
          return true;
        } catch (error: any) {
          console.error("Delete error:", error);
          toast.error("Failed to delete project");
          return false;
        }
      },
      updateProject: async (slug: string, updates: Partial<Project>, trigger: DeploymentTrigger = "settings") => {
        try {
          const { error } = await supabase
            .from("shelby_projects")
            .update({
              framework: updates.framework,
              build_output: updates.buildOutput,
            })
            .eq("slug", slug);

          if (error) throw error;
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
          const project = projects.find(p => p.slug === slug);
          if (!project) return false;

          const { error } = await supabase
            .from("shelby_domain_mappings")
            .upsert({
              project_id: project.id,
              domain,
              status: "pending",
              target: "shelby-gateway",
              slug: project.slug,
              content_hash: project.hash,
              kv_key: `domain:${domain}`
            }, { onConflict: "domain" });

          if (error) throw error;
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
          const { data, error } = await supabase.functions.invoke("verify-domain", {
            body: { slug, domain }
          });

          if (error) throw error;
          
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
          const { data, error } = await supabase
            .from("shelby_wallet_connections")
            .upsert({
              chain,
              address,
              wallet_provider: provider,
              status: "connected"
            }, { onConflict: "chain,address" })
            .select()
            .single();

          if (error) throw error;

          const next: WalletConnection = {
            chain: data.chain as Chain,
            provider: data.wallet_provider as any,
            address: data.address,
            status: "connected"
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
          const project = projects.find(p => p.slug === slug);
          if (!project) return false;

          const { error } = await supabase
            .from("shelby_github_connections")
            .insert({
              project_id: project.id,
              account: githubData?.account ?? "",
              repository: githubData?.repository ?? "",
              branch: githubData?.branch ?? "main",
            });

          if (error) throw error;
          await fetchProjects();
          toast.success("GitHub connected successfully");
          return true;
        } catch (error: any) {
          console.error("GitHub connection error:", error);
          toast.error("Failed to connect GitHub");
          return false;
        }
      },
      triggerGithubDeploy: async (slug: string) => {
        toast.info("Triggering GitHub Actions workflow...");
        return true;
      },
      linkGithub: async () => {
        try {
          await privyLinkGithub();
        } catch (error) {
          console.error("Privy GitHub link error:", error);
        }
      },
      fetchGithubRepos: async () => {
        // Look up linked GitHub account in Privy user
        const githubAccount = user?.linkedAccounts?.find(
          (acc: any) => acc.type === "github_oauth"
        ) as any;
        if (!githubAccount) return [];

        try {
          // Call the edge function proxy to avoid CORS + token exposure
          const { data, error } = await supabase.functions.invoke("github-repos");
          if (error) throw error;
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
            f.name === "index.html"
        );
        if (hasIndex) {
          return { valid: true, message: `✓ Found index.html in ${buildOutput}/ — ready to deploy.` };
        }
        return {
          valid: false,
          message: `✗ No index.html found in ${buildOutput}/. Run your build command first (e.g. npm run build).`,
        };
      }
    };
  }, [projects, loading, uploadProgress, wallet, user, authenticated]);

  return <ShelbyHostContext.Provider value={value}>{children}</ShelbyHostContext.Provider>;
}

export function useShelbyHost() {
  const context = useContext(ShelbyHostContext);
  if (!context) throw new Error("useShelbyHost must be used within ShelbyHostProvider");
  return context;
}
