import type { Metadata } from "next";
import "./globals.css";
import { AuthStatus } from "../components/AuthStatus";
import { ThemeToggle } from "../components/ThemeToggle";

const themeInit = `(function(){try{var t=localStorage.getItem("strata-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Strata",
  description: "Track personal projects with status, labels, and live activity from public GitHub repos."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <header className="site-header">
          <nav className="nav" aria-label="Primary">
            <a className="nav-brand" href="/">Strata</a>
            <a href="/projects">Projects</a>
            <a href="/login">Login</a>
            <a href="/register" className="btn btn-primary">Start tracking</a>
            <ThemeToggle />
            <AuthStatus />
          </nav>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
