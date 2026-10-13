"use client";
import { useState } from "react";
import { createClient } from "../lib/supabase-client";
import { syncRepoActivity, type SyncRepo } from "../lib/github-sync";

export type { SyncRepo };

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={spinning ? "sync-spin" : undefined} style={{ display: "inline-flex" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function SyncButton({ repos }: { repos: SyncRepo[] }) {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSync() {
    if (state === "syncing" || repos.length === 0) return;
    setState("syncing");
    setMessage(null);
    try {
      const supabase = createClient();
      for (const repo of repos) {
        await syncRepoActivity(supabase, repo);
      }
      setState("done");
      setMessage("Synced just now");
      window.location.reload();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        className="btn btn-secondary"
        onClick={onSync}
        disabled={state === "syncing" || repos.length === 0}
        title={repos.length === 0 ? "No repos linked yet" : "Pull latest GitHub activity"}
        style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
      >
        <RefreshIcon spinning={state === "syncing"} />
        {state === "syncing" ? "Syncing" : "Sync"}
      </button>
      {message && state !== "syncing" ? <span className="card-meta" style={{ marginTop: 0 }}>{message}</span> : null}
    </span>
  );
}
