import { createFileRoute } from "@tanstack/react-router";
import { createGithubAuthUrl } from "@/server/github-oauth.server";

export const Route = createFileRoute("/api/github/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectTo = url.searchParams.get("redirect") || "/dashboard";
        const authUrl = await createGithubAuthUrl(redirectTo);
        return Response.redirect(authUrl, 302);
      },
    },
  },
});
