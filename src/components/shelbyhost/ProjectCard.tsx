import { Link } from "@tanstack/react-router";
import { ExternalLink, GitBranch, Settings } from "lucide-react";
import type { Project } from "../../context/ShelbyHostContext";
import { formatBytes, StatusBadge } from "./AppShell";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="group rounded-lg border border-border bg-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/project/$slug" params={{ slug: project.slug }} className="text-lg font-bold text-foreground transition hover:text-primary">
            {project.name}
          </Link>
          <p className="mt-1 truncate font-mono text-sm text-primary">shelbyhost.pages.dev/p/{project.slug}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{project.description || "Permanent frontend deployed to Shelby hot storage."}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <p className="text-muted-foreground">Storage</p>
          <p className="font-semibold text-foreground">{formatBytes(project.size)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Source</p>
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            {project.source === "github" ? "GitHub" : "Upload"}
          </p>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <a href={`https://shelbyhost.pages.dev/p/${project.slug}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">
          <ExternalLink className="h-4 w-4" /> Visit
        </a>
        <Link to="/project/$slug" params={{ slug: project.slug }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </div>
    </article>
  );
}
