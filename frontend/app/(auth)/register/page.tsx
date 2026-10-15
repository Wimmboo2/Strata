"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import { clearPendingProfile, githubUsernameFromUrl } from "../../../lib/pending-profile";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const username = githubUsernameFromUrl(githubUrl);
    if (!username) {
      setError("GitHub profile link must look like https://github.com/username");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      const userId = data.user?.id;
      if (!userId) throw new Error("Registration succeeded but no user id returned");
      if (!data.session) {
        // Email confirmation is on: there is no session yet, so RLS forbids
        // the profile insert. Stash the profile fields and finish setup
        // after the user confirms and signs in.
        try {
          localStorage.setItem(
            PENDING_PROFILE_KEY,
            JSON.stringify({ githubUrl: githubUrl.trim(), displayName: displayName || null })
          );
        } catch {
          // Storage unavailable; the sign-in page offers manual setup instead.
        }
        setNotice("Account created. Confirm your email, then sign in — your profile will be finished automatically.");
        setLoading(false);
        return;
      }
      const { error: profileError } = await supabase.from("profiles").insert({ id: userId, display_name: displayName || null, github_profile_url: githubUrl.trim(), github_username: username });
      // 23505 = profile already exists (e.g. retried signup): safe to proceed,
      // the insert never overwrites another user's row (RLS check id = self).
      if (profileError && profileError.code !== "23505") throw profileError;
      clearPendingProfile();
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="kicker">Join</p>
      <h1>Register</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={onSubmit}>
          <div className="field"><label htmlFor="remail">Email</label><input id="remail" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="rpass">Password</label><input id="rpass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <div className="field"><label htmlFor="rname">Display name</label><input id="rname" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div className="field"><label htmlFor="rgh">GitHub profile link</label><input id="rgh" className="input" placeholder="https://github.com/username" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} required /></div>
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="card-meta">{notice}</p> : null}
          <button className="btn btn-primary btn-block btn" type="submit" disabled={loading}>{loading ? "Registering" : "Register"}</button>
        </form>
      </div>
    </div>
  );
}
