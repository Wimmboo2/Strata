"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

function githubUsernameFromUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0] : null;
  } catch {
    return null;
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const username = githubUsernameFromUrl(githubUrl);
    if (!username) {
      setError("GitHub profile link must look like https://github.com/username");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });
      if (signUpError) throw signUpError;
      const userId = data.user?.id;
      if (!userId) throw new Error("Registration succeeded but no user id returned");
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        display_name: displayName || null,
        github_profile_url: githubUrl.trim(),
        github_username: username
      });
      if (profileError) throw profileError;
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Register</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 400 }}>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input
          placeholder="GitHub profile link, e.g. https://github.com/username"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          required
        />
        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Registering" : "Register"}
        </button>
      </form>
    </div>
  );
}
