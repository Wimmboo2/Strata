"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase-client";

export default function EditProjectPage({ params }: { params: { id: string } }) {
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
      const { error: uError } = await supabase
        .from("projects")
        .update({ name, description, status, updated_at: new Date().toISOString() })
        .eq("id", params.id);
      if (uError) throw uError;
      await supabase.from("labels").delete().eq("project_id", params.id);
      const names = labels.split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length > 0) {
        const { error: lError } = await supabase
          .from("labels")
          .insert(names.map((n) => ({ project_id: params.id, name: n })));
        if (lError) throw lError;
      }
      window.location.href = `/projects/${params.id}`;
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
    window.location.href = "/projects";
  }

  if (loading) return <p>Loading.</p>;

  return (
    <div>
      <h1>Edit project</h1>
      <form onSubmit={onSave} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="building">building</option>
          <option value="finished">finished</option>
          <option value="paused">paused</option>
        </select>
        <input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="Labels, comma separated" />
        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        <button type="submit" disabled={saving}>{saving ? "Saving" : "Save"}</button>
        <button type="button" onClick={onDelete}>Delete project</button>
      </form>
    </div>
  );
}
