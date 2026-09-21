import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Github, Menu, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useState, type ReactNode } from "react";
import "../../public-pages.css";

export function PublicLogo() {
  return (
    <Link to="/" className="public-logo" aria-label="ShelbyHost home">
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="m18 2 15 9v16l-15 9L3 27V11L18 2Z" fill="currentColor" />
        <path
          d="m11 12 7-4 7 4-7 4-7-4Zm0 6 7 4 7-4m-14 6 7 4 7-4"
          stroke="#fffaf4"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        shelby<span className="logo-light">host</span>
        <span className="logo-dot">.</span>
      </span>
    </Link>
  );
}

export function DeployButton({
  children = "Start deploying",
  className = "",
  secondary = false,
}: {
  children?: ReactNode;
  className?: string;
  secondary?: boolean;
}) {
  const { authenticated, login } = useAuth();
  const classes = `public-button ${secondary ? "button-outline" : "button-coral"} ${className}`;
  return authenticated ? (
    <Link className={classes} to="/deploy">
      {children}
      <ArrowUpRight size={17} />
    </Link>
  ) : (
    <button className={classes} onClick={() => login()}>
      {children}
      <ArrowUpRight size={17} />
    </button>
  );
}

export function PublicHeader({ docs = false }: { docs?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <PublicLogo />
        <nav aria-label="Main navigation" className={`public-nav ${open ? "nav-open" : ""}`}>
          <a href="/#platform" onClick={() => setOpen(false)}>
            Platform
          </a>
          <a href="/#how-it-works" onClick={() => setOpen(false)}>
            How it works
          </a>
          <Link
            to="/docs"
            search={{ topic: "quickstart" }}
            aria-current={docs ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            Documentation
            <ArrowUpRight size={13} />
          </Link>
          <a
            href="https://github.com/linoxbt/shelby-deploy-magic"
            target="_blank"
            rel="noreferrer"
            className="nav-github"
            aria-label="ShelbyHost on GitHub"
          >
            <Github size={18} />
          </a>
        </nav>
        <div className="header-actions">
          {docs && <DeployButton>Open console</DeployButton>}
          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="footer-top">
        <div>
          <PublicLogo />
          <p>A new home for what you build.</p>
        </div>
        <div className="footer-links">
          <Link to="/docs" search={{ topic: "quickstart" }}>
            Documentation
            <ArrowUpRight size={14} />
          </Link>
          <a href="https://github.com/linoxbt/shelby-deploy-magic" target="_blank" rel="noreferrer">
            GitHub
            <ArrowUpRight size={14} />
          </a>
          <Link to="/grant">
            Platform brief
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} ShelbyHost</span>
        <span>Built for the builders. Powered by Shelby.</span>
        <a href="#top">
          Back to top <ArrowRight size={13} className="back-up" />
        </a>
      </div>
    </footer>
  );
}
