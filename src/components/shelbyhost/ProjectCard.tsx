import { Link } from "@tanstack/react-router";
import { ExternalLink, GitBranch, Settings } from "lucide-react";
import type { Project } from "../../context/ShelbyHostContext";
import { formatBytes, StatusBadge } from "./AppShell";

export function ProjectCard({ project }: { project: Project }) {
  const latest = project.deployments[0];
  return (
    <article className="group rounded-lg border border-border bg-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/project/$slug"
            params={{ slug: project.slug }}
            className="text-lg font-bold text-foreground transition hover:text-primary"
          >
            {project.name}
          </Link>
          <p className="mt-1 truncate font-mono text-sm text-primary">
            shelbyhost.xyz/p/{project.slug}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
        {project.description || "Permanent frontend deployed to Shelby hot storage."}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <p className="text-muted-foreground">Storage</p>
          <p className="font-semibold text-foreground">{formatBytes(project.size)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Source</p>
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            {project.source === "github" ? (project.github?.branch ?? "GitHub") : "Upload"}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-md border border-border bg-background/40 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Latest deploy</p>
          <a
            href={`https://explorer.aptoslabs.com/account/0xc36c2abd4d6a6fd5d3c5823588d15c9ac5ae90a2357c3ce3083a98ce2184e4af/modules/view/registry/register_project?network=testnet`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold text-primary hover:underline"
          >
            VERIFY ON-CHAIN
          </a>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="truncate font-mono text-xs text-primary">
            {latest?.hash.slice(0, 8) ?? project.hash.slice(0, 8)}
          </span>
          {latest && <StatusBadge status={latest.status} />}
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <a
          href={project.latestVersionUrl}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" /> Visit
        </a>
        <Link
          to="/project/$slug"
          params={{ slug: project.slug }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </div>
    </article>
  );
}
