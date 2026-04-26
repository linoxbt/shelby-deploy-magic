import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ShelbyHostProvider } from "../context/ShelbyHostContext";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ShelbyHost — Decentralized Frontend Hosting" },
      { name: "description", content: "Deploy once. Live forever with Shelby-powered decentralized frontend hosting." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "ShelbyHost — Decentralized Frontend Hosting" },
      { property: "og:description", content: "Deploy once. Live forever with Shelby-powered decentralized frontend hosting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "ShelbyHost — Decentralized Frontend Hosting" },
      { name: "twitter:description", content: "Deploy once. Live forever with Shelby-powered decentralized frontend hosting." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f9965be1-1d04-4023-9c28-80b6dfd29952/id-preview-328b4fa0--2e7eb6d0-f70e-48c7-aa55-d0c3a8a0ded2.lovable.app-1777244550635.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f9965be1-1d04-4023-9c28-80b6dfd29952/id-preview-328b4fa0--2e7eb6d0-f70e-48c7-aa55-d0c3a8a0ded2.lovable.app-1777244550635.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ShelbyHostProvider>
      <Outlet />
    </ShelbyHostProvider>
  );
}
