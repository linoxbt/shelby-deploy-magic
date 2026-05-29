import dns from "node:dns/promises";
import { requireAuth } from "./_lib/auth";
import { appBaseDomain } from "./_lib/env";
import { errorResponse, methodNotAllowed, readJson } from "./_lib/http";
import { sanitizeDomain } from "./_lib/normalize";
import { getOwnedProject, getSupabaseAdmin } from "./_lib/supabase";
import { addVercelProjectDomain, verifyVercelProjectDomain } from "./_lib/vercel";

type DomainPayload = {
  slug: string;
  domain: string;
};

function customDomainTarget() {
  return process.env.SHELBY_CUSTOM_DOMAIN_TARGET || "cname.vercel-dns.com";
}

async function hasValidDns(domain: string, target: string) {
  const expected = new Set(
    [
      target,
      customDomainTarget(),
      "cname.vercel-dns.com",
      "cname.vercel-dns-0.com",
      appBaseDomain(),
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ]
      .filter(Boolean)
      .map((value) => value!.replace(/\.$/, "").toLowerCase()),
  );

  const records: string[] = [];
  try {
    records.push(...(await dns.resolveCname(domain)).map((value) => value.replace(/\.$/, "")));
  } catch {
    // Apex domains often use A/ALIAS records; keep checking TXT-free paths below.
  }

  return records.some((record) => {
    const normalized = record.toLowerCase();
    return (
      expected.has(normalized) ||
      normalized.endsWith(".vercel-dns.com") ||
      /^cname\.vercel-dns-\d+\.com$/.test(normalized)
    );
  });
}

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "POST") {
      const body = await readJson<DomainPayload>(req);
      const project = await getOwnedProject(auth.userId, body.slug);
      const domain = sanitizeDomain(body.domain);

      const vercelDomain = await addVercelProjectDomain(domain);
      const { error } = await supabase.from("shelby_domain_mappings").upsert(
        {
          project_id: project.id,
          domain,
          status: "pending",
          target: customDomainTarget(),
          slug: project.slug,
          content_hash: project.content_hash,
          kv_key: `domain:${domain}`,
        },
        { onConflict: "domain" },
      );

      if (error) throw error;
      return res.status(201).json({
        ok: true,
        vercelDomain,
        message: `Domain registered. Point DNS to ${customDomainTarget()} or your Vercel-assigned target, then verify.`,
      });
    }

    if (req.method === "PATCH") {
      const body = await readJson<DomainPayload>(req);
      const project = await getOwnedProject(auth.userId, body.slug);
      const domain = sanitizeDomain(body.domain);

      const { data: mapping, error: mappingError } = await supabase
        .from("shelby_domain_mappings")
        .select("*")
        .eq("domain", domain)
        .eq("project_id", project.id)
        .maybeSingle();

      if (mappingError) throw mappingError;
      if (!mapping) throw new Error("Domain mapping not found");

      const vercelDomain = await verifyVercelProjectDomain(domain);
      const verified = await hasValidDns(domain, mapping.target || appBaseDomain());
      if (verified) {
        const { error } = await supabase
          .from("shelby_domain_mappings")
          .update({ status: "active" })
          .eq("id", mapping.id);
        if (error) throw error;
      }

      return res.status(200).json({
        verified,
        status: verified ? "active" : "pending",
        vercelDomain,
        message: verified
          ? "Domain verified"
          : `Add a CNAME record from ${domain} to ${customDomainTarget()}, then verify again.`,
      });
    }

    return methodNotAllowed(res, ["POST", "PATCH"]);
  } catch (error) {
    return errorResponse(res, error);
  }
}
