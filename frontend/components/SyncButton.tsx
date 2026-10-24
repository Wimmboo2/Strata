"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";
import type { SyncRepo } from "../lib/github-sync";

export type { SyncRepo };

/**
 * Statuses that mean "the backend is not reachable right now". Render's
 * free tier sleeps after 15 minutes idle and answers 503 with a loading
 * page while it spins back up; a proxy in front of it answers 502 or 504
 * when it cannot reach the origin at all. A network-level failure (fetch
 * throwing) means the same thing.
 */
const BACKEND_OFF_STATUSES = new Set([502, 503, 504]);
const RETRY_SECONDS = 10;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

type SyncState = "idle" | "syncing" | "done" | "error" | "offline";

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={spinning ? "sync-spin" : undefined} style={{ display: "inline-flex" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SyncButton({ repos, onDone }: { repos: SyncRepo[]; onDone?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(RETRY_SECONDS);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  function clearRetry() {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }

  function finish() {
    setState("done");
    setMessage("Synced just now");
    if (onDone) onDone();
    else router.refresh();
  }

  function fail(text: string) {
    setState("error");
    setMessage(text);
  }

  /** The backend is asleep or unreachable: say so, then try again shortly. */
  function goOffline() {
    if (cancelled.current) return;
    setState("offline");
    setRetryIn(RETRY_SECONDS);
    clearRetry();
    countdownTimer.current = setInterval(() => {
      setRetryIn((n) => (n > 1 ? n - 1 : 1));
    }, 1000);
    retryTimer.current = setTimeout(() => {
      clearRetry();
      if (!cancelled.current) void run();
    }, RETRY_SECONDS * 1000);
  }

  async function run() {
    if (cancelled.current) return;
    clearRetry();
    setState("syncing");
    setMessage(null);

    let accessToken: string | undefined;
    try {
      const supabase = createClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();
      accessToken = session?.access_token;
    } catch {
      accessToken = undefined;
    }
    if (!accessToken) {
      fail("Sign in again to sync");
      return;
    }

    const repoIds = repos.map((r) => r.id);

    let startRes: Response;
    try {
      startRes = await fetch("/api/backend/sync/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken,
          // Never let a CDN cache a sync response.
          "x-vercel-enable-rewrite-caching": "0"
        },
        body: JSON.stringify({ repo_ids: repoIds })
      });
    } catch {
      goOffline();
      return;
    }
    if (BACKEND_OFF_STATUSES.has(startRes.status)) {
      goOffline();
      return;
    }
    if (startRes.status === 401) {
      fail("Sign in again to sync");
      return;
    }
    if (!startRes.ok) {
      const body = (await startRes.json().catch(() => ({}))) as { error?: string };
      fail(body.error ?? "Sync failed");
      return;
    }

    const started = (await startRes.json().catch(() => ({}))) as { job_id?: string };
    if (!started.job_id) {
      fail("Sync failed");
      return;
    }

    // Poll until the background job reports a result.
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline && !cancelled.current) {
      await sleep(POLL_INTERVAL_MS);
      if (cancelled.current) return;

      let statusRes: Response;
      try {
        statusRes = await fetch("/api/backend/sync/status?job_id=" + encodeURIComponent(started.job_id), {
          headers: {
            Authorization: "Bearer " + accessToken,
            "x-vercel-enable-rewrite-caching": "0"
          }
        });
      } catch {
        goOffline();
        return;
      }
      if (BACKEND_OFF_STATUSES.has(statusRes.status)) {
        goOffline();
        return;
      }
      if (statusRes.status === 404) {
        // The job is unknown, which happens when the backend restarted
        // mid-run. Whatever it managed to write is still there.
        finish();
        return;
      }
      if (!statusRes.ok) {
        fail("Sync failed");
        return;
      }
      const status = (await statusRes.json().catch(() => ({}))) as {
        state?: string;
        synced?: number;
        skipped?: number;
        error?: string;
      };
      if (status.state === "done") {
        const skipped = status.skipped ?? 0;
        finish();
        if (skipped > 0) {
          setMessage("Synced just now — " + skipped + " private repo" + (skipped === 1 ? "" : "s") + " skipped");
        }
        return;
      }
      if (status.state === "error") {
        fail(status.error ?? "Sync failed");
        return;
      }
    }
    if (!cancelled.current) fail("Sync timed out");
  }

  const busy = state === "syncing";

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn btn-secondary"
        onClick={() => {
          clearRetry();
          void run();
        }}
        disabled={busy || repos.length === 0}
        title={repos.length === 0 ? "No repos linked yet" : "Pull latest GitHub activity"}
        style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
      >
        <RefreshIcon spinning={busy} />
        {busy ? "Syncing" : "Sync"}
      </button>
      {state === "offline" ? (
        <span className="card-meta" style={{ marginTop: 0 }} role="status">
          Backend is off. Retrying in {retryIn} second{retryIn === 1 ? "" : "s"}...
        </span>
      ) : message && !busy ? (
        <span className="card-meta" style={{ marginTop: 0 }}>{message}</span>
      ) : null}
    </span>
  );
}
