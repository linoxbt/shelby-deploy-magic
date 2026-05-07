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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { slug, domain } = await req.json();

    // 1. Get the domain mapping
    const { data: mapping, error: mapError } = await supabase
      .from("shelby_domain_mappings")
      .select("*")
      .eq("domain", domain)
      .eq("slug", slug)
      .single();

    if (mapError || !mapping) {
      return new Response(JSON.stringify({ error: "Domain mapping not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Perform DNS Lookup (using Cloudflare's JSON DNS API)
    // We check for a CNAME pointing to the gateway (e.g., shelbyhost.xyz or vercel project)
    const dnsUrl = `https://cloudflare-dns.com/dns-query?name=${domain}&type=CNAME`;
    const dnsRes = await fetch(dnsUrl, { headers: { Accept: "application/dns-json" } });
    const dnsData = await dnsRes.json();

    const isVerified = dnsData.Answer?.some(
      (ans: any) =>
        ans.data.includes("shelbyhost.xyz") ||
        ans.data.includes("vercel.app") ||
        ans.data.includes(mapping.target),
    );

    if (isVerified) {
      // 3. Update status to verified
      await supabase
        .from("shelby_domain_mappings")
        .update({ status: "verified", updated_at: new Date().toISOString() })
        .eq("id", mapping.id);

      return new Response(
        JSON.stringify({ verified: true, message: "Domain verified successfully!" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      return new Response(
        JSON.stringify({
          verified: false,
          message:
            "DNS record not found or incorrect. Ensure your CNAME points to your project target.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
