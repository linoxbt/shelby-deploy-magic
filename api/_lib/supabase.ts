import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  framework: string;
  build_output: string;
  content_hash: string;
  source: string;
  status: string;
  latest_version_url: string;
  storage_backend?: string | null;
  shelby_owner_address?: string | null;
  shelby_manifest?: unknown[] | null;
  shelby_uploaded_at?: string | null;
  shelby_upload_error?: string | null;
  chain: string;
  wallet_address: string | null;
  files: unknown[];
  size_bytes: number;
  deployed_at: string | null;
  created_at: string;
  updated_at: string;
  shelby_deployments?: unknown[];
  shelby_domain_mappings?: unknown[];
  shelby_github_connections?: unknown[];
  shelby_wallet_connections?: unknown[];
  deploy_token_hash?: string | null;
  deploy_token_last_four?: string | null;
};

export function getSupabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getOwnedProject(ownerId: string, slugOrId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("shelby_projects")
    .select("*")
    .eq("owner_id", ownerId)
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Project not found");
  return data as ProjectRow;
}

export async function isSlugAvailable(slug: string, ownerId?: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("shelby_projects")
    .select("id, owner_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return !data || (ownerId && data.owner_id === ownerId);
}

export function projectUrl(slug: string) {
  const baseDomain = process.env.SHELBY_BASE_DOMAIN || "shelbyhost.xyz";
  return `https://${slug}.${baseDomain}`;
}

export function versionUrl(hash: string) {
  return `${requireEnv("SUPABASE_URL")}/storage/v1/object/public/shelby_nodes/${hash}/index.html`;
}
