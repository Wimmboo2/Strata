"use client";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-client";

export function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    }
    load();
  }, []);
  if (!email) return null;
  return (
    <span style={{ marginLeft: "auto", display: "inline-flex", gap: 10, alignItems: "center" }}>
      <span className="tag tag-neutral">{email}</span>
      <button
        className="btn btn-ghost"
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          window.location.href = "/projects";
        }}
      >
        Logout
      </button>
    </span>
  );
}
