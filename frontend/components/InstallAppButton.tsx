"use client";
import { useState } from "react";
import { createClient } from "../lib/supabase-client";
import { GITHUB_APP_SLUG } from "../lib/github-app";

export function InstallAppButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slug not configured yet: render nothing rather than a dead link.
  if (!GITHUB_APP_SLUG) return null;

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

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        className="btn btn-secondary"
        onClick={onClick}
        disabled={busy}
        title="Link the GitHub App for instant updates"
        style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
      >
        {busy ? "Opening GitHub" : "Enable instant updates"}
      </button>
      {error ? <span className="form-error">{error}</span> : null}
    </span>
  );
}
