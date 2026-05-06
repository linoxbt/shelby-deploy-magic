import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the GitHub access token for this user from shelby_github_accounts
    const { data: ghAccount, error: ghError } = await supabase
      .from("shelby_github_accounts")
      .select("access_token_encrypted, login, avatar_url, html_url")
      .eq("owner_id", user.id)
      .single();

    if (ghError || !ghAccount) {
      return new Response(JSON.stringify({ error: "No GitHub account linked", repos: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch repos from GitHub API using the stored token
    const token = ghAccount.access_token_encrypted; // NOTE: decrypt if you add encryption
    const reposRes = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=pushed&type=owner",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "ShelbyHost/1.0",
        },
      }
    );

    if (!reposRes.ok) {
      const errBody = await reposRes.text();
      console.error("GitHub API error:", reposRes.status, errBody);
      return new Response(JSON.stringify({ error: "GitHub API error", repos: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repos = await reposRes.json();

    return new Response(
      JSON.stringify({
        account: {
          login: ghAccount.login,
          avatar_url: ghAccount.avatar_url,
          html_url: ghAccount.html_url,
        },
        repos,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("github-repos edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
