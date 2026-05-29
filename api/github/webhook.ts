import crypto from "node:crypto";
import { errorResponse, methodNotAllowed } from "../_lib/http";
import { getSupabaseAdmin } from "../_lib/supabase";

function verifySignature(secret: string, body: string, signature: string) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expected = `sha256=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const rawBody = await getRawBody(req);
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const signature = req.headers["x-hub-signature-256"] || "";
    if (secret && (!signature || !verifySignature(secret, rawBody, signature))) {
      return res.status(401).json({ error: "Invalid GitHub webhook signature" });
    }

    const event = req.headers["x-github-event"];
    if (event !== "push") return res.status(200).json({ message: `Ignored ${event}` });

    const payload = JSON.parse(rawBody);
    const repoFullName = payload?.repository?.full_name as string;
    const branch = String(payload?.ref || "").replace("refs/heads/", "");
    const commitSha = payload?.after as string;
    const commitMessage = payload?.head_commit?.message || "GitHub push";
    if (!repoFullName || !branch || !commitSha) throw new Error("Invalid GitHub push payload");

    const [account, repository] = repoFullName.split("/");
    const supabase = getSupabaseAdmin();
    const { data: connection, error: connectionError } = await supabase
      .from("shelby_github_connections")
      .select("id, project_id, account, repository, branch")
      .eq("account", account)
      .eq("repository", repository)
      .eq("branch", branch)
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) return res.status(200).json({ message: "No matching ShelbyHost project" });

    const { error: deploymentError } = await supabase.from("shelby_deployments").insert({
      project_id: connection.project_id,
      content_hash: commitSha,
      version_url: "",
      status: "queued",
      trigger: "github-push",
      message: commitMessage.slice(0, 200),
    });

    if (deploymentError) throw deploymentError;

    await supabase
      .from("shelby_projects")
      .update({ status: "processing" })
      .eq("id", connection.project_id);
    await supabase
      .from("shelby_github_connections")
      .update({ last_push_at: new Date().toISOString() })
      .eq("id", connection.id);

    return res.status(200).json({ message: "Deployment queued" });
  } catch (error) {
    return errorResponse(res, error);
  }
}
