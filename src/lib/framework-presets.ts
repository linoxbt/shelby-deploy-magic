export type FrameworkPreset = {
  id: string;
  label: string;
  buildCommand: string;
  output: string;
  runtime: "static" | "ssr" | "serverless" | "edge";
  status: "available" | "runner-required";
  category: "frontend" | "fullstack" | "docs" | "static";
};

export const frameworkPresets: FrameworkPreset[] = [
  { id: "vite", label: "Vite", buildCommand: "npm run build", output: "dist", runtime: "static", status: "available", category: "frontend" },
  { id: "tanstack-start", label: "TanStack Start", buildCommand: "npm run build", output: ".output/public", runtime: "ssr", status: "runner-required", category: "fullstack" },
  { id: "nextjs-static", label: "Next.js Static Export", buildCommand: "npm run build", output: "out", runtime: "static", status: "available", category: "fullstack" },
  { id: "nextjs", label: "Next.js SSR", buildCommand: "npm run build", output: ".next", runtime: "serverless", status: "runner-required", category: "fullstack" },
  { id: "react-router", label: "React Router Framework", buildCommand: "npm run build", output: "build/client", runtime: "ssr", status: "runner-required", category: "fullstack" },
  { id: "remix", label: "Remix", buildCommand: "npm run build", output: "build/client", runtime: "serverless", status: "runner-required", category: "fullstack" },
  { id: "astro-static", label: "Astro Static", buildCommand: "npm run build", output: "dist", runtime: "static", status: "available", category: "frontend" },
  { id: "astro-ssr", label: "Astro SSR", buildCommand: "npm run build", output: "dist", runtime: "serverless", status: "runner-required", category: "fullstack" },
  { id: "sveltekit-static", label: "SvelteKit Static", buildCommand: "npm run build", output: "build", runtime: "static", status: "available", category: "frontend" },
  { id: "sveltekit", label: "SvelteKit SSR", buildCommand: "npm run build", output: ".svelte-kit/output", runtime: "serverless", status: "runner-required", category: "fullstack" },
  { id: "nuxt-static", label: "Nuxt Static", buildCommand: "npm run generate", output: ".output/public", runtime: "static", status: "available", category: "frontend" },
  { id: "nuxt", label: "Nuxt SSR", buildCommand: "npm run build", output: ".output/public", runtime: "serverless", status: "runner-required", category: "fullstack" },
  { id: "solidstart", label: "SolidStart", buildCommand: "npm run build", output: ".output/public", runtime: "serverless", status: "runner-required", category: "fullstack" },
  { id: "qwik", label: "Qwik City", buildCommand: "npm run build", output: "dist", runtime: "serverless", status: "runner-required", category: "fullstack" },
  { id: "gatsby", label: "Gatsby", buildCommand: "npm run build", output: "public", runtime: "static", status: "available", category: "frontend" },
  { id: "vue", label: "Vue CLI", buildCommand: "npm run build", output: "dist", runtime: "static", status: "available", category: "frontend" },
  { id: "angular", label: "Angular", buildCommand: "npm run build", output: "dist", runtime: "static", status: "available", category: "frontend" },
  { id: "ember", label: "Ember", buildCommand: "npm run build", output: "dist", runtime: "static", status: "available", category: "frontend" },
  { id: "preact", label: "Preact", buildCommand: "npm run build", output: "dist", runtime: "static", status: "available", category: "frontend" },
  { id: "docusaurus", label: "Docusaurus", buildCommand: "npm run build", output: "build", runtime: "static", status: "available", category: "docs" },
  { id: "vitepress", label: "VitePress", buildCommand: "npm run docs:build", output: "docs/.vitepress/dist", runtime: "static", status: "available", category: "docs" },
  { id: "mkdocs", label: "MkDocs", buildCommand: "mkdocs build", output: "site", runtime: "static", status: "available", category: "docs" },
  { id: "hugo", label: "Hugo", buildCommand: "hugo", output: "public", runtime: "static", status: "available", category: "static" },
  { id: "jekyll", label: "Jekyll", buildCommand: "bundle exec jekyll build", output: "_site", runtime: "static", status: "available", category: "static" },
  { id: "static", label: "Static HTML", buildCommand: "echo static", output: ".", runtime: "static", status: "available", category: "static" },
];

export function findFrameworkPreset(id: string) {
  return frameworkPresets.find((preset) => preset.id === id) || frameworkPresets[0];
}
