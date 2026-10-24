"use client";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-client";
import { GITHUB_APP_SLUG } from "../lib/github-app";

type InstallState = "checking" | "enabled" | "partial" | "disabled";

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "inline-flex" }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function InstallAppButton() {
  const [state, setState] = useState<InstallState>("checking");
  const [covered, setCovered] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const supabase = createClient();
        const {
          data: { session }
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          if (!cancelled) setState("disabled");
          return;
        }
        const res = await fetch("/api/backend/github/install/status", {
          headers: { Authorization: "Bearer " + token }
        });
        if (!res.ok) {
          // Cannot confirm either way: keep the button so the user can
          // still act on it rather than claiming a state we cannot prove.
          if (!cancelled) setState("disabled");
          return;
        }
        const body = (await res.json()) as {
          enabled?: boolean;
          covered?: number;
          total?: number;
        };
        if (cancelled) return;
        const c = body.covered ?? 0;
        const t = body.total ?? 0;
        setCovered(c);
        setTotal(t);
        if (body.enabled) setState("enabled");
        else if (c > 0) setState("partial");
        else setState("disabled");
      } catch {
        if (!cancelled) setState("disabled");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sign in again first");
      const res = await fetch("/api/backend/github/install/setup", {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
      const body = (await res.json().catch(() => ({}))) as { state?: string; error?: string };
      if (!res.ok || !body.state) {
        throw new Error(body.error ?? "Setup failed");
      }
      window.location.href =
        "https://github.com/apps/" + GITHUB_APP_SLUG + "/installations/new?state=" + encodeURIComponent(body.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  if (state === "enabled") {
    return (
      <span
        className="tag tag-accent-2"
        title="The GitHub App is installed, so pushes, pull requests and issues arrive automatically."
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <CheckIcon />
        Instant updates enabled
      </span>
    );
  }

  // Slug not configured yet: render nothing rather than a dead link.
  if (!GITHUB_APP_SLUG) return null;

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        className="btn btn-secondary"
        onClick={onClick}
        disabled={busy || state === "checking"}
        title={
          state === "partial"
            ? "The GitHub App is installed but does not cover every repo yet"
            : "Link the GitHub App for instant updates"
        }
        style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
      >
        {busy ? "Opening GitHub" : "Enable instant updates"}
      </button>
      {state === "partial" ? (
        <span className="card-meta" style={{ marginTop: 0 }}>
          Covers {covered} of {total} repos
        </span>
      ) : null}
      {error ? <span className="form-error">{error}</span> : null}
    </span>
  );
}
