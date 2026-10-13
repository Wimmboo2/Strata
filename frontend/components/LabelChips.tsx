"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase-client";

export function LabelChips({
  projectId,
  labels,
  editable,
  suggestions,
  onChange
}: {
  projectId: string;
  labels: string[];
  editable: boolean;
  suggestions?: string[];
  onChange?: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(labels);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setLocal(labels);
  }, [labels]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const available = (suggestions ?? []).filter((s) => !local.includes(s));

  async function add(name: string) {
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    if (!clean || local.includes(clean) || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("labels").insert({ project_id: projectId, name: clean });
    setBusy(false);
    if (!error) {
      const next = [...local, clean];
      setLocal(next);
      setInput("");
      onChange?.(next);
    }
  }

  async function remove(name: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("labels").delete().eq("project_id", projectId).eq("name", name);
    setBusy(false);
    if (!error) {
      const next = local.filter((l) => l !== name);
      setLocal(next);
      onChange?.(next);
    }
  }

  return (
    <span className="dropdown-wrap" ref={ref}>
      {local.map((l) => (
        <span key={l} className="tag tag-neutral">{l}</span>
      ))}
      {editable ? (
        <button type="button" className="tag tag-outline chip-btn" onClick={() => setOpen((o) => !o)} aria-label="Edit labels">
          {open ? "close" : "+ labels"}
        </button>
      ) : null}
      {open ? (
        <span className="dropdown" role="menu">
          {local.length > 0 ? (
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {local.map((l) => (
                <button key={l} type="button" className="tag tag-neutral chip-btn" onClick={() => remove(l)} title="Remove label">
                  {l} {"\u00d7"}
                </button>
              ))}
            </span>
          ) : (
            <span className="card-meta" style={{ marginTop: 0 }}>No labels yet</span>
          )}
          <span style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              style={{ minHeight: 32, padding: "4px 12px", fontSize: 13 }}
              placeholder="Add label"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(input);
                }
              }}
              autoFocus
            />
            <button type="button" className="btn btn-secondary" style={{ padding: "6px 14px", minHeight: 32 }} onClick={() => add(input)}>
              Add
            </button>
          </span>
          {available.length > 0 ? (
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {available.slice(0, 8).map((s) => (
                <button key={s} type="button" className="tag tag-outline chip-btn" onClick={() => add(s)}>
                  {s}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
