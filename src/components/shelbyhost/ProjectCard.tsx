import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Box, GitBranch, MoreHorizontal } from "lucide-react";
import { projectPublicUrl, type Project } from "../../context/ShelbyHostContext";
import { formatBytes, StatusBadge } from "./AppShell";

export function ProjectCard({ project }: { project: Project }) {
  const latest = project.deployments[0];
  const publicUrl = projectPublicUrl(project.slug);
  return (
    <article className="project-card">
      <div className="project-card-top">
        <span className="project-glyph">
          <Box size={18} />
        </span>
        <StatusBadge status={project.status} />
        <button aria-label={`More options for ${project.name}`}>
          <MoreHorizontal size={17} />
        </button>
      </div>
      <Link to="/project/$slug" params={{ slug: project.slug }} className="project-name">
        {project.name}
      </Link>
      <a href={publicUrl} target="_blank" rel="noreferrer" className="project-url">
        {publicUrl.replace(/^https?:\/\//, "")}
        <ArrowUpRight size={12} />
      </a>
      <p className="project-description">
        {project.description || "A production frontend stored immutably on Shelby Network."}
      </p>
      <div className="project-meta">
        <span>
          <small>Framework</small>
          <strong>{project.framework || "Auto"}</strong>
        </span>
        <span>
          <small>Storage</small>
          <strong>{formatBytes(project.size)}</strong>
        </span>
        <span>
          <small>Source</small>
          <strong>
            <GitBranch size={12} />
            {project.source === "github" ? project.github?.branch || "GitHub" : "Upload"}
          </strong>
        </span>
      </div>
      <div className="project-release">
        <div>
          <i />
          <span>
            <small>Latest release</small>
            <strong>{latest?.hash?.slice(0, 10) || project.hash.slice(0, 10) || "Building"}</strong>
          </span>
        </div>
        <Link to="/project/$slug" params={{ slug: project.slug }}>
          Manage <ArrowUpRight size={13} />
        </Link>
      </div>
    </article>
  );
}
