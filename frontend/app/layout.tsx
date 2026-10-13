import type { Metadata } from "next";
import "./globals.css";
import { AuthStatus } from "../components/AuthStatus";

export const metadata: Metadata = {
  title: "Strata",
  description: "Track personal projects with live GitHub activity"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: "1px solid #e5e5e5", padding: "12px 24px" }}>
          <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <a href="/">Strata</a>
            <a href="/projects">Projects</a>
            <a href="/projects/new">New</a>
            <a href="/login">Login</a>
            <a href="/register">Register</a>
            <AuthStatus />
          </nav>
        </header>
        <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
