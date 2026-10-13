"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

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
      <p className="kicker">Welcome back</p>
      <h1>Login</h1>
      <div className="card" style={{ maxWidth: 440 }}>
        <form onSubmit={onSubmit}>
          <div className="field"><label htmlFor="lemail">Email</label><input id="lemail" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="lpass">Password</label><input id="lpass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Logging in" : "Login"}</button>
        </form>
      </div>
    </div>
  );
}
