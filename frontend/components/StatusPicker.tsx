"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase-client";
import type { ProjectStatus } from "../lib/types";

const OPTIONS: ProjectStatus[] = ["building", "finished", "paused"];
const tone: Record<ProjectStatus, string> = {
  building: "tag-accent",
  finished: "tag-accent-2",
  paused: "tag-neutral"
};

export function StatusPicker({
  projectId,
  status,
  editable,
  onChange
}: {
  projectId: string;
  status: ProjectStatus;
  editable: boolean;
  onChange?: (next: ProjectStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(status);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setLocal(status);
  }, [status]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function pick(next: ProjectStatus) {
    setOpen(false);
    if (next === local || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ status: next, updated_at: new Date().toISOString() }).eq("id", projectId);
    setBusy(false);
    if (!error) {
      setLocal(next);
      onChange?.(next);
    }
  }

  if (!editable) {
    return <span className={"tag " + tone[local]}>{local}</span>;
  }

  return (
    <span className="dropdown-wrap" ref={ref}>
      <button type="button" className={"tag chip-btn " + tone[local]} onClick={() => setOpen((o) => !o)} aria-label="Change status">
        {local}
      </button>
      {open ? (
        <span className="dropdown" role="menu">
          {OPTIONS.map((s) => (
            <button key={s} type="button" className="chip-btn" style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: "4px 0", cursor: "pointer", textAlign: "left" }} onClick={() => pick(s)}>
              <span className={"tag " + tone[s]}>{s}</span>
              {s === local ? <span className="card-meta" style={{ marginTop: 0 }}>current</span> : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
