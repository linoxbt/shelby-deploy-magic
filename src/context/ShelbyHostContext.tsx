import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";

export type ProjectStatus = "live" | "processing" | "failed";
export type DeploymentStatus = "queued" | "succeeded" | "failed";
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

interface ShelbyHostContextValue {
  projects: Project[];
  loading: boolean;
  wallet?: WalletConnection;
  createProject: (data: Partial<Project>) => Promise<Project | null>;
  deployProject: (projectId: string, files: FileEntry[], message?: string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  connectWallet: (chain: Chain, address: string, provider: string) => Promise<WalletConnection | null>;
  connectGithub: (slug: string, githubData: Project["github"]) => Promise<boolean>;
  fetchGithubRepos: () => Promise<any[]>;
  linkGithub: () => Promise<void>;
}

const ShelbyHostContext = createContext<ShelbyHostContextValue | null>(null);

const TARGET_HOST = "shelbyhost.pages.dev";

const now = () => new Date().toISOString();
const makeRandomHash = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const versionUrl = (slug: string, hash: string) => `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/shelby_nodes/${hash}/index.html`;

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
  const [wallet, setWallet] = useState<WalletConnection | undefined>();
  const { user, authenticated, linkGithub: privyLinkGithub } = usePrivy();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      // Use Privy authentication state instead of Supabase auth directly if possible, 
      // but keep Supabase for DB access. We'll use the user ID from Privy if available.
      if (!authenticated || !user) {
        setProjects([]);
        setLoading(false);
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
        files: p.files as FileEntry[],
        deployedAt: p.deployed_at,
        size: p.size_bytes,
        hash: p.content_hash,
        status: p.status as ProjectStatus,
        source: p.source as "drag-drop" | "github",
        framework: p.framework,
        buildOutput: p.build_output,
        latestVersionUrl: p.latest_version_url,
        chain: p.chain as Chain,
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
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [authenticated, user]);

  const value = useMemo(() => {
    return {
      projects,
      loading,
      wallet,
      createProject: async (projectData: Partial<Project>) => {
        try {
          const slug = projectData.name?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "project";
          const { data: { user: sbUser } } = await supabase.auth.getUser();
          
          const { data, error } = await supabase
            .from("shelby_projects")
            .insert({
              name: projectData.name,
              slug,
              description: projectData.description,
              user_id: sbUser?.id,
              status: "processing",
              source: projectData.source || "drag-drop",
              chain: projectData.chain || "aptos",
              wallet_address: projectData.walletAddress,
            })
            .select()
            .single();

          if (error) throw error;
          
          const newProject: Project = {
            ...projectData,
            id: data.id,
            slug: data.slug,
            status: "processing",
            deployments: [],
            files: [],
            hash: "",
            deployedAt: null,
            size: 0,
            chain: data.chain as Chain,
          } as Project;

          setProjects(prev => [newProject, ...prev]);
          toast.success("Project created successfully");
          return newProject;
        } catch (error: any) {
          console.error("Error creating project:", error);
          toast.error("Failed to create project");
          return null;
        }
      },
      deployProject: async (projectId: string, files: FileEntry[], message?: string) => {
        try {
          toast.info("Starting deployment...");
          const hash = await generateRealHash(files);
          const project = projects.find(p => p.id === projectId);
          if (!project) return false;

          const vUrl = versionUrl(project.slug, hash);
          const totalSize = files.reduce((sum, f) => sum + f.size, 0);

          const { data, error } = await supabase
            .from("shelby_deployments")
            .insert({
              project_id: projectId,
              content_hash: hash,
              version_url: vUrl,
              status: "succeeded",
              trigger: "manual",
              message: message || "Manual deployment",
            })
            .select()
            .single();

          if (error) throw error;

          await supabase
            .from("shelby_projects")
            .update({
              content_hash: hash,
              latest_version_url: vUrl,
              deployed_at: now(),
              size_bytes: totalSize,
              status: "live",
            })
            .eq("id", projectId);

          await fetchProjects();
          toast.success("Deployment successful!");
          return true;
        } catch (error: any) {
          console.error("Deployment error:", error);
          toast.error("Deployment failed");
          return false;
        }
      },
      deleteProject: async (projectId: string) => {
        try {
          const { error } = await supabase
            .from("shelby_projects")
            .delete()
            .eq("id", projectId);

          if (error) throw error;
          setProjects(prev => prev.filter(p => p.id !== projectId));
          toast.success("Project deleted");
          return true;
        } catch (error: any) {
          console.error("Delete error:", error);
          toast.error("Failed to delete project");
          return false;
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
              account: githubData?.account,
              repository: githubData?.repository,
              branch: githubData?.branch,
              status: "active",
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
      connectWallet: async (chain: Chain, address: string, provider: string) => {
        try {
          const { data: { user: sbUser } } = await supabase.auth.getUser();
          const { data, error } = await supabase
            .from("shelby_wallet_connections")
            .upsert({
              user_id: sbUser?.id,
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
      linkGithub: async () => {
        try {
          await privyLinkGithub();
        } catch (error) {
          console.error("Privy GitHub link error:", error);
          toast.error("Failed to link GitHub account");
        }
      },
      fetchGithubRepos: async () => {
        try {
          // Check if user has a linked GitHub account in Privy
          const githubAccount = user?.linkedAccounts.find(acc => acc.type === 'github_oauth');
          
          if (!githubAccount) {
            toast.info("Please link your GitHub account first.");
            return [];
          }

          // In Privy, to get the actual API token for GitHub, we usually need to use the 
          // getAccessToken or use specific OAuth flows. 
          // For now, if they are linked, we'll suggest using the manual import or 
          // redirect to the linking flow.
          
          // Note: If you want to fetch repos, you need a GitHub token. 
          // Privy provides this if configured correctly in the dashboard.
          
          toast.error("GitHub repository fetching is being migrated to Privy. Please use manual import for now.");
          return [];
        } catch (error: any) {
          console.error("GitHub fetch error:", error);
          return [];
        }
      },
    };
  }, [projects, loading, wallet, user, authenticated]);

  return <ShelbyHostContext.Provider value={value}>{children}</ShelbyHostContext.Provider>;
}

export function useShelbyHost() {
  const context = useContext(ShelbyHostContext);
  if (!context) throw new Error("useShelbyHost must be used within ShelbyHostProvider");
  return context;
}
