import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed } from "../_lib/http";
import { shelbyStatus } from "../_lib/shelby";

function configured(name: string) {
  return Boolean(process.env[name]);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    await requireAuth(req);

    return res.status(200).json({
      ok: true,
      storage: shelbyStatus(),
      githubApp: {
        configured: configured("GITHUB_APP_ID") && configured("GITHUB_APP_PRIVATE_KEY"),
        installUrl: process.env.GITHUB_APP_INSTALL_URL || null,
      },
      customDomains: {
        vercelAutomation: configured("VERCEL_TOKEN") && configured("VERCEL_PROJECT_ID"),
        target: process.env.SHELBY_CUSTOM_DOMAIN_TARGET || "cname.vercel-dns.com",
      },
      auth: {
        privy: configured("PRIVY_APP_ID") && configured("PRIVY_APP_SECRET"),
      },
      database: {
        supabaseAdmin: configured("SUPABASE_URL") && configured("SUPABASE_SERVICE_ROLE_KEY"),
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
