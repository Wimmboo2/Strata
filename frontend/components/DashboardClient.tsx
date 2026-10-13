"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";
import type { Project, ProjectStatus } from "../lib/types";
import { ProjectCard } from "./ProjectCard";
import { SyncButton } from "./SyncButton";
import { SortDropdown } from "./SortDropdown";
import { importProfileRepos, type SyncRepo } from "../lib/github-sync";

const TABS: { value: ProjectStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "building", label: "Building" },
  { value: "finished", label: "Finished" },
  { value: "paused", label: "Paused" }
];

const SORTS: { value: string; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" }
];

export function DashboardClient({
  initialProjects,
  initialLabelsByProject,
  initialMyRepos,
  initialRepoActivity,
  initialAuthed,
  initialUserId
}: {
  initialProjects: Project[];
  initialLabelsByProject: Record<string, string[]>;
  initialMyRepos: SyncRepo[];
  initialRepoActivity: Record<string, string>;
  initialAuthed: boolean;
  initialUserId: string | null;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [labelsByProject, setLabelsByProject] = useState(initialLabelsByProject);
  const [myRepos, setMyRepos] = useState(initialMyRepos);
  const [repoActivity, setRepoActivity] = useState(initialRepoActivity);
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [label, setLabel] = useState("");
  const [sort, setSort] = useState("updated");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const didImport = useRef(false);

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);
  useEffect(() => {
    setLabelsByProject(initialLabelsByProject);
  }, [initialLabelsByProject]);
  useEffect(() => {
    setMyRepos(initialMyRepos);
  }, [initialMyRepos]);
  useEffect(() => {
    setRepoActivity(initialRepoActivity);
  }, [initialRepoActivity]);

  useEffect(() => {
    if (!initialAuthed || !initialUserId || didImport.current) return;
    didImport.current = true;
    (async () => {
      try {
        const supabase = createClient();
        const added = await importProfileRepos(supabase, initialUserId);
        if (added > 0) {
          setNotice("Added " + added + " repo" + (added === 1 ? "" : "s") + " from GitHub");
          router.refresh();
        }
      } catch {
        // silent: import is best-effort
      }
    })();
  }, [initialAuthed, initialUserId, router]);

  const visible = useMemo(() => {
    const filtered = projects
      .filter((p) => !status || p.status === status)
      .filter((p) => {
        if (!label.trim()) return true;
        const names = labelsByProject[p.id] ?? [];
        return names.some((n) => n.toLowerCase().includes(label.trim().toLowerCase()));
      });
    const sorted = [...filtered];
    const activity = (p: Project) => repoActivity[p.id] ?? p.updated_at;
    sorted.sort((a, b) => {
      switch (sort) {
        case "created":
          return b.created_at.localeCompare(a.created_at);
        case "oldest":
          return a.created_at.localeCompare(b.created_at);
        case "name":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        default:
          return activity(b).localeCompare(activity(a));
      }
    });
    return sorted;
  }, [projects, labelsByProject, status, label, sort, repoActivity]);

  const counts = useMemo(
    () => ({
      building: projects.filter((p) => p.status === "building").length,
      finished: projects.filter((p) => p.status === "finished").length,
      paused: projects.filter((p) => p.status === "paused").length
    }),
    [projects]
  );

  async function onAddRepos() {
    if (adding || !initialUserId) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const added = await importProfileRepos(supabase, initialUserId, { force: true });
      if (added > 0) {
        setNotice("Added " + added + " repo" + (added === 1 ? "" : "s"));
        router.refresh();
      } else {
        setNotice("No new repos found on GitHub");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add repos failed");
    } finally {
      setAdding(false);
    }
  }

  function handleStatusChange(projectId: string, next: ProjectStatus) {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: next, updated_at: new Date().toISOString() } : p)));
  }

  const authed = initialAuthed;

  return (
    <div>
      <p className="kicker">{authed ? "Dashboard" : "Library"}</p>
      <h1>{authed ? "Dashboard" : "Projects"}</h1>
      {authed ? (
        <div className="grid-3" style={{ marginBottom: 18 }}>
          <div className="card"><div className="card-kicker">Building</div><div className="card-title" style={{ fontSize: 32 }}>{counts.building}</div></div>
          <div className="card"><div className="card-kicker">Finished</div><div className="card-title" style={{ fontSize: 32 }}>{counts.finished}</div></div>
          <div className="card"><div className="card-kicker">Paused</div><div className="card-title" style={{ fontSize: 32 }}>{counts.paused}</div></div>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "inline-flex", background: "var(--color-surface)", borderRadius: 999, padding: 4, gap: 2 }} role="tablist" aria-label="Filter by status">
          {TABS.map((t) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={status === t.value}
              onClick={() => setStatus(t.value)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 999,
                padding: "8px 16px",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: 600,
                background: status === t.value ? "var(--accent-600)" : "transparent",
                color: status === t.value ? "#fff8ef" : "var(--color-text)"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 200 }} placeholder="Filter by label" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Filter by label" />
        <SortDropdown value={sort} options={SORTS} onChange={setSort} ariaLabel="Sort projects" />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="card-meta" style={{ marginBottom: 12 }}>{notice}</p> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="card-meta" style={{ marginTop: 0 }}>{visible.length + " project" + (visible.length === 1 ? "" : "s")}</span>
        {authed ? (
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary" onClick={onAddRepos} disabled={adding}>{adding ? "Adding" : "Add repos"}</button>
            <SyncButton repos={myRepos} />
          </span>
        ) : null}
      </div>
      {visible.length === 0 && !authed ? (
        <div className="card"><div className="card-title">No projects yet</div><p className="card-body">Register to start tracking your own projects.</p><p><a className="btn btn-primary" href="/register">Register to start tracking</a></p></div>
      ) : null}
      {visible.length === 0 && authed ? (
        <div className="card">
          <div className="card-title">No projects yet</div>
          <p className="card-body">Add repos to pull your public GitHub repositories in automatically.</p>
          <p><button className="btn btn-primary" onClick={onAddRepos} disabled={adding}>{adding ? "Adding" : "Add repos"}</button></p>
        </div>
      ) : null}
      <div className="grid-3">
        {visible.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            editable={authed && p.owner_id === initialUserId}
            onStatusChange={(next) => handleStatusChange(p.id, next)}
          />
        ))}
      </div>
    </div>
  );
}
