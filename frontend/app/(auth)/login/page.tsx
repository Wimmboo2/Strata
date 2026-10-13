"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 400 }}>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Logging in" : "Login"}
        </button>
      </form>
    </div>
  );
}
