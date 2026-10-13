"use client";
import { useEffect, useRef, useState } from "react";

export interface SortOption {
  value: string;
  label: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function SortDropdown({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <span className="dropdown-wrap" ref={ref}>
      <button
        type="button"
        className="input chip-btn"
        style={{ width: "auto", display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 200 }}
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current ? current.label : ""}</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <span className="dropdown" role="listbox" style={{ minWidth: 220 }}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className="chip-btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                background: o.value === value ? "var(--accent-100)" : "transparent",
                border: "none",
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 14,
                color: "var(--color-text)",
                fontFamily: "var(--font-body)"
              }}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {o.value === value ? <span style={{ fontSize: 12, opacity: 0.7 }}>current</span> : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
