"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase-client";
import { Select } from "../../../../components/Select";
import { BackLink } from "../../../../components/BackLink";

const STATUS_OPTIONS = [
  { value: "building", label: "building" },
  { value: "finished", label: "finished" },
  { value: "paused", label: "paused" }
];

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"building" | "finished" | "paused">("building");
  const [labels, setLabels] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: project, error: pError } = await supabase.from("projects").select("*").eq("id", params.id).single();
        if (pError) throw pError;
        setName(project.name);
        setDescription(project.description ?? "");
        setStatus(project.status);
        const { data: labelRows } = await supabase.from("labels").select("*").eq("project_id", params.id);
        setLabels((labelRows ?? []).map((r: { name: string }) => r.name).join(", "));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: uError } = await supabase.from("projects").update({ name, description, status, updated_at: new Date().toISOString() }).eq("id", params.id);
      if (uError) throw uError;
      await supabase.from("labels").delete().eq("project_id", params.id);
      const names = labels.split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length > 0) {
        const { error: lError } = await supabase.from("labels").insert(names.map((n) => ({ project_id: params.id, name: n })));
        if (lError) throw lError;
      }
      router.push("/projects/" + params.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this project?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", params.id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  if (loading) {
    return (
      <div>
        <div className="skeleton skeleton-line" style={{ width: 110, height: 13, marginBottom: 16 }} />
        <div className="skeleton skeleton-line" style={{ width: 200, height: 38, marginBottom: 22, borderRadius: 14 }} />
        <div className="skeleton skeleton-card" style={{ maxWidth: 520 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div className="skeleton skeleton-line" style={{ width: 90, height: 11, marginBottom: 10 }} />
              <div className="skeleton skeleton-line" style={{ width: "100%", height: 36 }} />
            </div>
          ))}
          <div className="skeleton skeleton-line" style={{ width: 120, height: 38 }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <p className="kicker">Edit entry</p>
      <h1>Edit project</h1>
      <div className="card">
        <form onSubmit={onSave}>
          <div className="field"><label htmlFor="ename">Project name</label><input id="ename" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label htmlFor="edesc">Description</label><textarea id="edesc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="field">
            <label id="estatus-label" htmlFor="estatus">Status</label>
            <Select
              id="estatus"
              labelId="estatus-label"
              value={status}
              options={STATUS_OPTIONS}
              onChange={(next) => setStatus(next as typeof status)}
            />
          </div>
          <div className="field"><label htmlFor="elabels">Labels</label><input id="elabels" className="input" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="frontend, side-project" /></div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving" : "Save"}</button>{" "}
          <button className="btn btn-secondary" type="button" onClick={onDelete}>Delete project</button>
        </form>
      </div>
    </div>
  );
}
