import type { Metadata } from "next";
import "./globals.css";
import { AuthStatus } from "../components/AuthStatus";

export const metadata: Metadata = {
  title: "Strata",
  description: "Track personal projects with status, labels, and live activity from public GitHub repos."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="nav" aria-label="Primary">
            <a className="nav-brand" href="/">Strata</a>
            <a href="/projects">Projects</a>
            <a href="/login">Login</a>
            <a href="/register" className="btn btn-primary">Register</a>
            <AuthStatus />
          </nav>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
