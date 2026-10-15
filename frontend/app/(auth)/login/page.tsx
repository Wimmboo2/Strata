"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import { clearPendingProfile, githubUsernameFromUrl, readPendingProfile } from "../register/page";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function ensureProfile(userId: string): Promise<boolean> {
    const supabase = createClient();
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (existing) {
      clearPendingProfile();
      return true;
    }
    // No profile yet (e.g. signup happened while email confirmation was on).
    // Prefer the values stashed at registration; fall back to the manual form.
    const pending = readPendingProfile();
    if (pending) {
      const username = githubUsernameFromUrl(pending.githubUrl);
      if (username) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: userId,
          display_name: pending.displayName,
          github_profile_url: pending.githubUrl,
          github_username: username
        });
        if (!insertError || insertError.code === "23505") {
          clearPendingProfile();
          return true;
        }
      }
    }
    return false;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in succeeded but no user was returned");
      if (await ensureProfile(user.id)) {
        router.push("/projects");
      } else {
        setNeedsSetup(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSetupSubmit(e: React.FormEvent) {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You are no longer signed in");
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        display_name: displayName || null,
        github_profile_url: githubUrl.trim(),
        github_username: username
      });
      // RLS only permits id = self, so this can never create another user's profile.
      if (insertError && insertError.code !== "23505") throw insertError;
      clearPendingProfile();
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="kicker">Welcome back</p>
      <h1>{needsSetup ? "Finish setup" : "Login"}</h1>
      <div className="card" style={{ maxWidth: 440 }}>
        {!needsSetup ? (
          <form onSubmit={onSubmit}>
            <div className="field"><label htmlFor="lemail">Email</label><input id="lemail" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="field"><label htmlFor="lpass">Password</label><input id="lpass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Logging in" : "Login"}</button>
          </form>
        ) : (
          <form onSubmit={onSetupSubmit}>
            <p className="card-body">Your account has no profile yet. Add your details once to finish setup.</p>
            <div className="field"><label htmlFor="sname">Display name</label><input id="sname" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
            <div className="field"><label htmlFor="sgh">GitHub profile link</label><input id="sgh" className="input" placeholder="https://github.com/username" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} required /></div>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Saving" : "Finish setup"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
