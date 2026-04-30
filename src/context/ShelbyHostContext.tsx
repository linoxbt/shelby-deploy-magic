import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  loading: boolean;
  wallet?: WalletConnection;
  domainMappings: CustomDomain[];
  addProject: (project: Omit<Project, "id" | "deployedAt" | "status" | "deployments" | "latestVersionUrl">) => Promise<Project | null>;
  updateProject: (slug: string, patch: Partial<Project>, trigger?: DeploymentTrigger) => Promise<void>;
  deleteProject: (slug: string) => Promise<void>;
  registerDomain: (slug: string, domain: string) => Promise<void>;
  connectGithub: (slug: string, connection: Omit<GithubConnection, "workflowFile" | "webhookStatus" | "lastPushAt">) => Promise<void>;
  triggerGithubDeploy: (slug: string) => Promise<void>;
  connectWallet: (chain?: Chain) => Promise<WalletConnection | null>;
  checkBuildOutput: (files: FileEntry[], buildOutput: string) => BuildCheck;
  generateSlug: (name: string) => string;
  generateHash: (files: FileEntry[]) => Promise<string>;
  generateRandomHash: () => string;
  fetchGithubRepos: () => Promise<any[]>;
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

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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
      toast.error("Failed to load projects from Supabase");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchProjects();
      } else if (event === "SIGNED_OUT") {
        setProjects([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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

    return {
      projects,
      loading,
      wallet,
      domainMappings: projects.flatMap((project) => (project.domain ? [project.domain] : [])),
      generateSlug,
      generateHash: generateRealHash,
      generateRandomHash: makeRandomHash,
      checkBuildOutput,
      addProject: async (project) => {
        try {
          const check = checkBuildOutput(project.files, project.buildOutput);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("User not authenticated");

            // Upload to "Shelby Nodes" (simulated by Supabase Storage)
            const uploadPromises = project.files.map(async (f) => {
              if (f.file) {
                // Strip the build output prefix so the site is served from the root of the hash
                const prefix = `/${project.buildOutput}/`;
                const cleanPath = f.path.startsWith(prefix) ? f.path.slice(prefix.length - 1) : f.path;
                const filePath = `${project.hash}${cleanPath}`;
                
                await supabase.storage.from("shelby_nodes").upload(filePath, f.file, {
                  upsert: true,
                  contentType: f.type,
                });
              }
            });
            await Promise.all(uploadPromises);

            const { data: newProject, error: projectError } = await supabase
              .from("shelby_projects")
              .insert({
              name: project.name,
              slug: project.slug,
              description: project.description,
              framework: project.framework,
              build_output: project.buildOutput,
              content_hash: project.hash,
              source: project.source,
              status: check.valid ? "live" : "failed",
              latest_version_url: versionUrl(project.slug, project.hash),
              chain: project.chain,
              wallet_address: project.walletAddress,
              files: project.files as any,
              size_bytes: project.size,
              deployed_at: now(),
              owner_id: user.id
            })
            .select()
            .single();

          if (projectError) throw projectError;

          const { error: deploymentError } = await supabase
            .from("shelby_deployments")
            .insert({
              project_id: newProject.id,
              status: check.valid ? "succeeded" : "failed",
              trigger: "manual",
              version_url: newProject.latest_version_url,
              content_hash: newProject.content_hash,
              message: check.valid ? "Build output check passed and the deployment is live." : check.message,
            });

          if (deploymentError) throw deploymentError;

          await fetchProjects();
          toast.success("Project created successfully");
          return projects.find(p => p.id === newProject.id) || null;
        } catch (error: any) {
          console.error("Error adding project:", error);
          toast.error(`Failed to create project: ${error.message}`);
          return null;
        }
      },
      updateProject: async (slug, patch, trigger = "settings") => {
        try {
          const project = projects.find(p => p.slug === slug);
          if (!project) throw new Error("Project not found");

          const output = patch.buildOutput ?? project.buildOutput;
          const files = patch.files ?? project.files;
          const nextHash = trigger === "hash" && patch.hash ? patch.hash : await generateRealHash(files);
          const check = checkBuildOutput(files, output);

          const { error: projectError } = await supabase
            .from("shelby_projects")
            .update({
              ...patch,
              content_hash: nextHash,
              latest_version_url: versionUrl(slug, nextHash),
              status: check.valid ? "processing" : "failed",
            } as any)
            .eq("id", project.id);

          if (projectError) throw projectError;

          await supabase.from("shelby_deployments").insert({
            project_id: project.id,
            status: "queued",
            trigger,
            version_url: versionUrl(slug, nextHash),
            content_hash: nextHash,
            message: trigger === "github-push" ? "Push received from ShelbyHost GitHub Action." : "Project settings changed. Automatic redeploy queued.",
          });

          await fetchProjects();

          // Simulate processing time for better UX
          setTimeout(async () => {
            await supabase.from("shelby_projects").update({
              status: check.valid ? "live" : "failed",
              deployed_at: check.valid ? now() : project.deployedAt,
            }).eq("id", project.id);

            await supabase.from("shelby_deployments").insert({
              project_id: project.id,
              status: check.valid ? "succeeded" : "failed",
              trigger,
              version_url: versionUrl(slug, nextHash),
              content_hash: nextHash,
              message: check.valid ? "Redeploy completed and latest version URL updated." : check.message,
            });

            await fetchProjects();
          }, 1400);

        } catch (error: any) {
          console.error("Error updating project:", error);
          toast.error(`Update failed: ${error.message}`);
        }
      },
      deleteProject: async (slug) => {
        try {
          const project = projects.find(p => p.slug === slug);
          if (!project) throw new Error("Project not found");

          const { error } = await supabase
            .from("shelby_projects")
            .delete()
            .eq("id", project.id);

          if (error) throw error;

          setProjects(current => current.filter(p => p.slug !== slug));
          toast.success("Project deleted");
        } catch (error: any) {
          console.error("Error deleting project:", error);
          toast.error("Failed to delete project");
        }
      },
      registerDomain: async (slug, domain) => {
        try {
          const project = projects.find(p => p.slug === slug);
          if (!project) throw new Error("Project not found");

          const normalized = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
          
          const { error } = await supabase
            .from("shelby_domain_mappings")
            .upsert({
              project_id: project.id,
              domain: normalized,
              slug: project.slug,
              content_hash: project.hash,
              target: TARGET_HOST,
              status: "verified",
              kv_key: `host:${normalized}`
            }, { onConflict: "domain" });

          if (error) throw error;

          await fetchProjects();
          toast.success("Domain registered");
        } catch (error: any) {
          console.error("Error registering domain:", error);
          toast.error("Domain registration failed");
        }
      },
      connectGithub: async (slug, connection) => {
        try {
          const project = projects.find(p => p.slug === slug);
          if (!project) throw new Error("Project not found");

          const { error } = await supabase
            .from("shelby_github_connections")
            .upsert({
              project_id: project.id,
              account: connection.account,
              repository: connection.repository,
              branch: connection.branch,
              workflow_file: ".github/workflows/shelbyhost-deploy.yml",
              webhook_status: "active",
              last_push_at: now()
            }, { onConflict: "project_id,repository,branch" });

          if (error) throw error;

          await supabase.from("shelby_projects").update({ source: "github" }).eq("id", project.id);
          await fetchProjects();
          toast.success("GitHub repository connected");
        } catch (error: any) {
          console.error("Error connecting GitHub:", error);
          toast.error("GitHub connection failed");
        }
      },
      triggerGithubDeploy: async (slug) => {
        const project = projects.find(p => p.slug === slug);
        if (project) {
          // This would normally trigger a GH Action, here we just queue a redeploy
          const patch: Partial<Project> = { status: "processing" };
          const trigger: DeploymentTrigger = "github-push";
          
          const nextHash = makeRandomHash();
          await supabase.from("shelby_deployments").insert({
            project_id: project.id,
            status: "queued",
            trigger,
            version_url: versionUrl(slug, nextHash),
            content_hash: nextHash,
            message: "Manual trigger of GitHub deployment simulation.",
          });
          
          await fetchProjects();
          
          setTimeout(async () => {
            await supabase.from("shelby_projects").update({
              status: "live",
              content_hash: nextHash,
              latest_version_url: versionUrl(slug, nextHash),
              deployed_at: now(),
            }).eq("id", project.id);
            
            await fetchProjects();
          }, 1400);
        }
      },
      connectWallet: async (chain = "aptos") => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Auth required");

          const address = chain === "aptos" ? "0x7e5b1a2c9f4d88a0" : "shelby1q9x7k2m4n8";
          const provider = chain === "aptos" ? "Petra" : "Shelby Wallet";

          const { data, error } = await supabase
            .from("shelby_wallet_connections")
            .upsert({
              owner_id: user.id,
              chain,
              wallet_provider: provider,
              address,
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
      fetchGithubRepos: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.provider_token) {
            // If no token, we can try to sign in with github
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'github',
              options: {
                scopes: 'repo',
                redirectTo: window.location.href
              }
            });
            if (error) throw error;
            return [];
          }

          const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
            headers: {
              Authorization: `Bearer ${session.provider_token}`,
            },
          });

          if (!response.ok) {
            if (response.status === 401) {
              // Token expired or invalid, re-auth
               await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                  scopes: 'repo',
                  redirectTo: window.location.href
                }
              });
              return [];
            }
            throw new Error("Failed to fetch GitHub repositories");
          }
          
          return await response.json();
        } catch (error: any) {
          console.error("GitHub fetch error:", error);
          toast.error("Could not fetch repositories. Ensure you are connected to GitHub.");
          return [];
        }
      },
    };
  }, [projects, loading, wallet]);

  return <ShelbyHostContext.Provider value={value}>{children}</ShelbyHostContext.Provider>;
}

export function useShelbyHost() {
  const context = useContext(ShelbyHostContext);
  if (!context) throw new Error("useShelbyHost must be used within ShelbyHostProvider");
  return context;
}
