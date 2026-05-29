import { appBaseDomain } from "./env";

type VercelDomainResult =
  | { configured: false; reason: string }
  | { configured: true; name: string; apexName?: string };

function vercelApiUrl(path: string) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (process.env.VERCEL_TEAM_ID) {
    url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  }
  return url.toString();
}

function projectId() {
  return process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;
}

async function vercelRequest(path: string, init: RequestInit = {}) {
  const token = process.env.VERCEL_TOKEN;
  const project = projectId();
  if (!token || !project) {
    return {
      skipped: true as const,
      reason: "Set VERCEL_TOKEN and VERCEL_PROJECT_ID to auto-register custom domains.",
    };
  }

  const response = await fetch(
    vercelApiUrl(path.replace(":project", encodeURIComponent(project))),
    {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    },
  );

  if (!response.ok && response.status !== 409) {
    const text = await response.text();
    throw new Error(`Vercel domain API failed ${response.status}: ${text.slice(0, 240)}`);
  }

  return { skipped: false as const, response };
}

export async function addVercelProjectDomain(domain: string): Promise<VercelDomainResult> {
  if (domain.endsWith(`.${appBaseDomain()}`)) {
    return { configured: true, name: domain };
  }

  const result = await vercelRequest("/v10/projects/:project/domains", {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });

  if (result.skipped) return { configured: false, reason: result.reason };
  return { configured: true, name: domain };
}

export async function verifyVercelProjectDomain(domain: string): Promise<VercelDomainResult> {
  if (domain.endsWith(`.${appBaseDomain()}`)) {
    return { configured: true, name: domain };
  }

  const result = await vercelRequest(
    `/v9/projects/:project/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" },
  );

  if (result.skipped) return { configured: false, reason: result.reason };
  return { configured: true, name: domain };
}
