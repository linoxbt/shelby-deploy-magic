import { createFileRoute } from "@tanstack/react-router";
import { getConnectedGithubAccount, listGithubRepositories } from "@/server/github-oauth.server";

export const Route = createFileRoute("/api/github/repos")({
  server: {
    handlers: {
      GET: async () => {
        const account = await getConnectedGithubAccount();
        if (!account) return Response.json({ account: null, repos: [] });
        const repos = await listGithubRepositories();
        return Response.json({ account, repos });
      },
    },
  },
});
