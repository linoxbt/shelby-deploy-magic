import publish from "../../api/publish";
import oauthStart from "../../api/github/oauth/start";
import oauthCallback from "../../api/github/oauth/callback";
import type { Config } from "@netlify/functions";
import { invokeHandler } from "../../api/_lib/node-adapter";
import { tenantRoute } from "../../api/_lib/routing";
import projects from "../../api/projects";
import project from "../../api/projects/[slug]";
import projectEnv from "../../api/projects/[slug]/env";
import legacyDeployment from "../../api/projects/[slug]/deployments";
import deployments from "../../api/deployments";
import domains from "../../api/domains";
import wallets from "../../api/wallets";
import status from "../../api/system/status";
import account from "../../api/github/account";
import connect from "../../api/github/connect";
import repos from "../../api/github/repos";
import appSetup from "../../api/github/app/setup";
import workflow from "../../api/github/workflow";
import trigger from "../../api/github/trigger";
import webhook from "../../api/github/webhook";
import githubEnv from "../../api/github/env";
import finalize from "../../api/github/finalize";
import githubUploads from "../../api/github/upload-urls";
import storageUploads from "../../api/storage/upload-urls";
const routes: Record<string, typeof projects> = {
  "/api/github/oauth/start": oauthStart,
  "/api/github/oauth/callback": oauthCallback,
  "/api/publish": publish,
  "/api/projects": projects,
  "/api/deployments": deployments,
  "/api/domains": domains,
  "/api/wallets": wallets,
  "/api/system/status": status,
  "/api/github/account": account,
  "/api/github/connect": connect,
  "/api/github/repos": repos,
  "/api/github/app/setup": appSetup,
  "/api/github/workflow": workflow,
  "/api/github/trigger": trigger,
  "/api/github/webhook": webhook,
  "/api/github/env": githubEnv,
  "/api/github/finalize": finalize,
  "/api/github/upload-urls": githubUploads,
  "/api/storage/upload-urls": storageUploads,
};
export default async function handler(request: Request) {
  const url = new URL(request.url);
  // User-controlled sites must never expose the authenticated control-plane API.
  if (tenantRoute(url.hostname))
    return Response.json({ error: "Unknown control-plane host" }, { status: 404 });
  const exact = routes[url.pathname];
  if (exact) return invokeHandler(request, exact, {}, url.pathname === "/api/github/webhook");
  const match = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)(?:\/(env|deployments))?$/);
  if (match)
    return invokeHandler(
      request,
      match[2] === "env" ? projectEnv : match[2] === "deployments" ? legacyDeployment : project,
      { slug: match[1] },
    );
  return Response.json({ error: "API route not found" }, { status: 404 });
}
export const config: Config = { path: "/api/*" };
