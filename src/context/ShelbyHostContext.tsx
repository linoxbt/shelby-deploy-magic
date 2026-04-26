import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ProjectStatus = "live" | "processing" | "failed";

export interface FileEntry {
  name: string;
  size: number;
  type: string;
  path: string;
}

export interface CustomDomain {
  domain: string;
  status: "verified" | "pending";
  target: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  files: FileEntry[];
  deployedAt: string;
  size: number;
  hash: string;
  status: ProjectStatus;
  source: "drag-drop" | "github";
  domain?: CustomDomain;
}

interface ShelbyHostContextValue {
  projects: Project[];
  addProject: (project: Omit<Project, "id" | "deployedAt" | "status">) => Project;
  updateProject: (slug: string, patch: Partial<Project>) => void;
  deleteProject: (slug: string) => void;
  generateSlug: (name: string) => string;
  generateHash: () => string;
}

const STORAGE_KEY = "shelbyhost-projects";
const ShelbyHostContext = createContext<ShelbyHostContextValue | null>(null);

const seedProjects: Project[] = [
  {
    id: "seed-lunex",
    name: "Lunex Finance",
    slug: "lunex-finance",
    description: "A static DeFi analytics frontend stored on Shelby hot storage.",
    files: [
      { name: "index.html", size: 18240, type: "HTML", path: "/index.html" },
      { name: "assets/app.css", size: 34880, type: "CSS", path: "/assets/app.css" },
      { name: "assets/main.js", size: 244120, type: "JS", path: "/assets/main.js" },
    ],
    deployedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    size: 297240,
    hash: "a3f721bc9e04d15f7c8ab2e091634d72",
    status: "live",
    source: "github",
    domain: { domain: "myproject.com", status: "verified", target: "shelbyhost.pages.dev" },
  },
  {
    id: "seed-aurumx",
    name: "AurumX Landing",
    slug: "aurumx-landing",
    description: "Marketing page deployed from a pre-built dist folder.",
    files: [
      { name: "index.html", size: 14960, type: "HTML", path: "/index.html" },
      { name: "assets/hero.webp", size: 491520, type: "Image", path: "/assets/hero.webp" },
    ],
    deployedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    size: 506480,
    hash: "b91c334e6ad7f409cc8a22e18a7d924f",
    status: "live",
    source: "drag-drop",
    domain: { domain: "app.aurumx.io", status: "pending", target: "shelbyhost.pages.dev" },
  },
];

export function ShelbyHostProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(seedProjects);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch {
        setProjects(seedProjects);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const value = useMemo<ShelbyHostContextValue>(() => {
    const generateSlug = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "untitled-project";

    const generateHash = () =>
      Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    return {
      projects,
      generateSlug,
      generateHash,
      addProject: (project) => {
        const next: Project = {
          ...project,
          id: crypto.randomUUID?.() ?? `${Date.now()}`,
          deployedAt: new Date().toISOString(),
          status: "live",
        };
        setProjects((current) => [next, ...current.filter((item) => item.slug !== next.slug)]);
        return next;
      },
      updateProject: (slug, patch) => {
        setProjects((current) => current.map((item) => (item.slug === slug ? { ...item, ...patch } : item)));
      },
      deleteProject: (slug) => {
        setProjects((current) => current.filter((item) => item.slug !== slug));
      },
    };
  }, [projects]);

  return <ShelbyHostContext.Provider value={value}>{children}</ShelbyHostContext.Provider>;
}

export function useShelbyHost() {
  const context = useContext(ShelbyHostContext);
  if (!context) throw new Error("useShelbyHost must be used within ShelbyHostProvider");
  return context;
}
