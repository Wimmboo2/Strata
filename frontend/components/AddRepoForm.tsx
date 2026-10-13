"use client";
import { useState } from "react";
import { createClient } from "../../lib/supabase-client";

export function AddRepoForm({ projectId }: { projectId: string }) {
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = repo.trim().toLowerCase();
    if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(normalized)) {
      setError("Repo must look like owner/repo");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: rError } = await supabase
        .from("project_repos")
        .insert({ project_id: projectId, repo_full_name: normalized });
      if (rError) throw rError;
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
      <button type="submit" disabled={loading}>{loading ? "Adding" : "Add repo"}</button>
      {error ? <span style={{ color: "red" }}>{error}</span> : null}
    </form>
  );
}
