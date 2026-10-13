import type { Metadata } from "next";
import "./globals.css";
import { Caprasimo, Figtree } from "next/font/google";
import { AuthStatus } from "../components/AuthStatus";
import { ThemeToggle } from "../components/ThemeToggle";
import { createServerSupabaseClient } from "../lib/supabase-server";

const caprasimo = Caprasimo({ weight: "400", subsets: ["latin"], variable: "--font-caprasimo", display: "swap" });
const figtree = Figtree({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Strata",
  description: "Track personal projects with status, labels, and live activity from public GitHub repos."
};

const themeInit = `(function(){try{var t=localStorage.getItem("strata-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let authed = false;
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.auth.getSession();
    authed = !!data.session;
  } catch {
    authed = false;
  }
  return (
    <html lang="en" className={caprasimo.variable + " " + figtree.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <header className="site-header">
          <nav className="nav" aria-label="Primary">
            <a className="nav-brand" href={authed ? "/projects" : "/"}>Strata</a>
            {authed ? (
              <a href="/projects">Dashboard</a>
            ) : (
              <>
                <a href="/projects">Projects</a>
                <a href="/login">Login</a>
                <a href="/register" className="btn btn-primary">Start tracking</a>
              </>
            )}
            <ThemeToggle />
            <AuthStatus />
          </nav>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
