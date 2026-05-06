import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

async function verifyGithubSignature(
  secret: string,
  payload: string,
  signature: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expected = `sha256=${encodeHex(new Uint8Array(sig))}`;
    return expected === signature;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET") ?? "";
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256") ?? "";

    // Verify HMAC signature if secret is set
    if (webhookSecret) {
      const valid = await verifyGithubSignature(webhookSecret, rawBody, signature);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const event = req.headers.get("x-github-event");
    if (event !== "push") {
      // Only process push events
      return new Response(JSON.stringify({ message: `Ignored event: ${event}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const repoFullName: string = payload?.repository?.full_name ?? "";
    const branchRef: string = payload?.ref ?? ""; // refs/heads/main
    const branch = branchRef.replace("refs/heads/", "");
    const commitSha: string = payload?.after ?? "";
    const commitMessage: string = payload?.head_commit?.message ?? "GitHub push";

    if (!repoFullName || !branch) {
      return new Response(JSON.stringify({ error: "Missing repo or branch info" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the github connection for this repo + branch
    const { data: connection, error: connError } = await supabase
      .from("shelby_github_connections")
      .select("id, project_id, branch")
      .ilike("repository", repoFullName.split("/")[1])
      .eq("branch", branch)
      .single();

    if (connError || !connection) {
      console.log(`No ShelbyHost project found for ${repoFullName}@${branch}`);
      return new Response(JSON.stringify({ message: "No matching project" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Queue a deployment
    const { error: depError } = await supabase.from("shelby_deployments").insert({
      project_id: connection.project_id,
      content_hash: commitSha,
      version_url: "", // Will be updated when build completes
      status: "queued",
      trigger: "github-push",
      message: commitMessage.slice(0, 200),
    });

    if (depError) throw depError;

    // Mark project as processing
    await supabase
      .from("shelby_projects")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", connection.project_id);

    // Update last_push_at on the github connection
    await supabase
      .from("shelby_github_connections")
      .update({ last_push_at: new Date().toISOString() })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({ message: "Deployment queued", project_id: connection.project_id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("github-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
