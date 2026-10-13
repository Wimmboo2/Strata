"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-client";
import type { Project, ProjectStatus } from "../../lib/types";
import { ProjectCard } from "../../components/ProjectCard";
import { FilterBar } from "../../components/FilterBar";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [labelsByProject, setLabelsByProject] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const supabase = createClient();
        let query = supabase.from("projects").select("*").order("updated_at", { ascending: false });
        if (status) query = query.eq("status", status);
        const { data, error: qError } = await query;
        if (qError) throw qError;
        setProjects(data ?? []);
        if (data && data.length > 0) {
          const { data: labelRows, error: lError } = await supabase.from("labels").select("*").in("project_id", data.map((p) => p.id));
          if (lError) throw lError;
          const grouped: Record<string, string[]> = {};
          for (const row of labelRows ?? []) {
            if (!grouped[row.project_id]) grouped[row.project_id] = [];
            grouped[row.project_id].push(row.name);
          }
          setLabelsByProject(grouped);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [status]);

  const filtered = projects.filter((p) => {
    if (!label.trim()) return true;
    const names = labelsByProject[p.id] ?? [];
    return names.some((n) => n.toLowerCase().includes(label.trim().toLowerCase()));
  });

  return (
    <div>
      <p className="kicker">Library</p>
      <h1>Projects</h1>
      <FilterBar status={status} label={label} onStatus={setStatus} onLabel={setLabel} />
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <div className="grid-3">{[0, 1, 2].map((i) => (<div key={i} className="card"><div className="card-title">Loading</div></div>))}</div> : null}
      {!loading && filtered.length === 0 ? (
        <div className="card"><div className="card-title">No projects yet</div><p className="card-body">Create your first project to start tracking.</p><p><a className="btn btn-primary" href="/projects/new">New project</a></p></div>
      ) : null}
      <div className="grid-3">
        {filtered.map((p) => (<ProjectCard key={p.id} project={p} labels={labelsByProject[p.id] ?? []} />))}
      </div>
    </div>
  );
}
