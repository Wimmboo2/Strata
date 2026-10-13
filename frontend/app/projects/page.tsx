"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-client";
import type { Project, ProjectStatus } from "../../lib/types";
import { ProjectCard } from "../../components/ProjectCard";
import { SyncButton } from "../../components/SyncButton";
import { importProfileRepos, type SyncRepo } from "../../lib/github-sync";

const TABS: { value: ProjectStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "building", label: "Building" },
  { value: "finished", label: "Finished" },
  { value: "paused", label: "Paused" }
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [labelsByProject, setLabelsByProject] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [myRepos, setMyRepos] = useState<SyncRepo[]>([]);
  const [adding, setAdding] = useState(false);
  const didImport = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id ?? null;
        if (cancelled) return;
        setAuthed(!!uid);

        let added = 0;
        if (uid && !didImport.current) {
          didImport.current = true;
          try {
            added = await importProfileRepos(supabase, uid);
          } catch {
            added = 0;
          }
        }
        if (cancelled) return;
        if (added > 0) setNotice("Added " + added + " repo" + (added === 1 ? "" : "s") + " from GitHub");

        let query = supabase.from("projects").select("*").order("updated_at", { ascending: false });
        if (status) query = query.eq("status", status);
        const { data, error: qError } = await query;
        if (qError) throw qError;
        if (cancelled) return;
        setProjects(data ?? []);

        const grouped: Record<string, string[]> = {};
        if (data && data.length > 0) {
          const { data: labelRows } = await supabase.from("labels").select("*").in("project_id", data.map((p) => p.id));
          for (const row of labelRows ?? []) {
            if (!grouped[row.project_id]) grouped[row.project_id] = [];
            grouped[row.project_id].push(row.name);
          }
        }
        if (cancelled) return;
        setLabelsByProject(grouped);

        if (uid && data && data.length > 0) {
          const myIds = data.filter((p) => p.owner_id === uid).map((p) => p.id);
          if (myIds.length > 0) {
            const { data: repoRows } = await supabase.from("project_repos").select("id,repo_full_name").in("project_id", myIds);
            if (cancelled) return;
            setMyRepos(((repoRows ?? []) as SyncRepo[]).filter((r) => r.repo_full_name.split("/").length === 2));
          } else {
            setMyRepos([]);
          }
        } else {
          setMyRepos([]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function onAddRepos() {
    if (adding) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const added = await importProfileRepos(supabase, uid, { force: true });
      if (added > 0) {
        window.location.reload();
      } else {
        setNotice("No new repos found on GitHub");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add repos failed");
    } finally {
      setAdding(false);
    }
  }

  const filtered = projects.filter((p) => {
    if (!label.trim()) return true;
    const names = labelsByProject[p.id] ?? [];
    return names.some((n) => n.toLowerCase().includes(label.trim().toLowerCase()));
  });

  const counts = {
    building: projects.filter((p) => p.status === "building").length,
    finished: projects.filter((p) => p.status === "finished").length,
    paused: projects.filter((p) => p.status === "paused").length
  };

  return (
    <div>
      <p className="kicker">{authed ? "Dashboard" : "Library"}</p>
      <h1>{authed ? "Dashboard" : "Projects"}</h1>
      {authed && !loading ? (
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
        <input className="input" style={{ maxWidth: 220 }} placeholder="Filter by label" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Filter by label" />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="card-meta" style={{ marginBottom: 12 }}>{notice}</p> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="card-meta" style={{ marginTop: 0 }}>{loading ? "" : filtered.length + " project" + (filtered.length === 1 ? "" : "s")}</span>
        {authed && !loading ? (
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary" onClick={onAddRepos} disabled={adding}>{adding ? "Adding" : "Add repos"}</button>
            <SyncButton repos={myRepos} />
          </span>
        ) : null}
      </div>
      {loading ? <div className="grid-3">{[0, 1, 2].map((i) => (<div key={i} className="card"><div className="card-title">Loading</div></div>))}</div> : null}
      {!loading && filtered.length === 0 && !authed ? (
        <div className="card"><div className="card-title">No projects yet</div><p className="card-body">Register to start tracking your own projects.</p><p><a className="btn btn-primary" href="/register">Register to start tracking</a></p></div>
      ) : null}
      {!loading && filtered.length === 0 && authed ? (
        <div className="card">
          <div className="card-title">No projects yet</div>
          <p className="card-body">Add repos to pull your public GitHub repositories in automatically.</p>
          <p><button className="btn btn-primary" onClick={onAddRepos} disabled={adding}>{adding ? "Adding" : "Add repos"}</button></p>
        </div>
      ) : null}
      <div className="grid-3">
        {filtered.map((p) => (<ProjectCard key={p.id} project={p} labels={labelsByProject[p.id] ?? []} />))}
      </div>
    </div>
  );
}
