import { createFileRoute } from "@tanstack/react-router";
import { completeGithubOAuth, getOrigin } from "@/server/github-oauth.server";

export const Route = createFileRoute("/api/public/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error_description") || url.searchParams.get("error");
        const origin = getOrigin();

        if (error) return Response.redirect(`${origin}/dashboard?github_error=${encodeURIComponent(error)}`, 302);
        if (!code || !state) return Response.redirect(`${origin}/dashboard?github_error=Missing%20GitHub%20callback%20data`, 302);

        try {
          const redirectTo = await completeGithubOAuth(code, state);
          return Response.redirect(`${origin}${redirectTo}?github_connected=1`, 302);
        } catch (callbackError) {
          const message = callbackError instanceof Error ? callbackError.message : "GitHub connection failed";
          return Response.redirect(`${origin}/dashboard?github_error=${encodeURIComponent(message)}`, 302);
        }
      },
    },
  },
});
