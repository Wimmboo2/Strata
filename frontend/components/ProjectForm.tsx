"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";
import { PROJECT_STATUSES, type ProjectStatus } from "../lib/types";

export function ProjectForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("building");
  const [labels, setLabels] = useState("");
  const [repos, setRepos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData.user?.id;
      if (!ownerId) throw new Error("Login required");
      if (projectId) throw new Error("Editing not implemented in v1 scaffold");
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({ owner_id: ownerId, name, description, status })
        .select()
        .single();
      if (projectError) throw projectError;
      const labelNames = labels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (labelNames.length > 0) {
        const { error: labelError } = await supabase.from("labels").insert(
          labelNames.map((n) => ({ project_id: project.id, name: n }))
        );
        if (labelError) throw labelError;
      }
      const repoNames = repos
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      for (const r of repoNames) {
        if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(r)) {
          throw new Error(`Invalid repo full name: ${r}`);
        }
      }
      if (repoNames.length > 0) {
        const { error: repoError } = await supabase.from("project_repos").insert(
          repoNames.map((repo_full_name) => ({ project_id: project.id, repo_full_name }))
        );
        if (repoError) throw repoError;
      }
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input placeholder="Labels, comma separated" value={labels} onChange={(e) => setLabels(e.target.value)} />
      <input placeholder="Repos, e.g. owner/repo, comma separated" value={repos} onChange={(e) => setRepos(e.target.value)} />
      {error ? <p style={{ color: "red" }}>{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? "Saving" : "Create project"}
      </button>
    </form>
  );
}
