"use client";
import { useEffect, useRef, useState } from "react";
import { useDropdownFlip } from "../lib/use-dropdown-flip";

export interface SelectOption {
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
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flex: "0 0 auto" }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Custom select, replacing the native <select> element.
 *
 * The native control renders an OS-styled dropdown that ignores the
 * theme's surface, radius and typography. This builds the same menu out of
 * the project's own dropdown primitives so it matches every other control.
 *
 * Accessibility notes:
 * - The trigger is a button with aria-haspopup="listbox" and aria-expanded.
 * - The menu is a listbox; each option is an option with aria-selected.
 * - Arrow keys move the highlight, Enter/Space choose, Escape closes and
 *   returns focus to the trigger, Home/End jump to the ends.
 */
export function Select({
  id,
  labelId,
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select",
  disabled = false
}: {
  id?: string;
  labelId?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  });
  const { ref, up, measure } = useDropdownFlip<HTMLSpanElement>(280);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref]);

  // Move DOM focus onto the highlighted option when the menu opens, so
  // screen readers announce it.
  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
    // Only on open: arrow keys move focus explicitly, and hovering must
    // never steal focus away from the keyboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle() {
    if (disabled) return;
    measure();
    // Open with the highlight on the current value.
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    setOpen((o) => !o);
  }

  /** Move the highlight and the keyboard focus together. */
  function moveActive(next: number) {
    const i = options.length === 0 ? 0 : next;
    setActiveIndex(i);
    optionRefs.current[i]?.focus();
  }

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        measure();
        // Open with the highlight on the current value.
        const idx = options.findIndex((o) => o.value === value);
        setActiveIndex(idx >= 0 ? idx : 0);
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive((activeIndex + 1) % Math.max(1, options.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive((activeIndex - 1 + options.length) % Math.max(1, options.length));
    } else if (e.key === "Home") {
      e.preventDefault();
      moveActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveActive(Math.max(0, options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <span
      className="dropdown-wrap"
      ref={ref}
      style={{ display: "block", width: "100%" }}
      // The handler lives on the wrapper, not the trigger: while the menu is
      // open focus sits on an option button, so key events bubble up from
      // there rather than from the trigger.
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="input chip-btn"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          textAlign: "left"
        }}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : placeholder}
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <span
          className={"dropdown" + (up ? " dropdown-up" : "")}
          role="listbox"
          aria-labelledby={labelId}
          style={{ minWidth: "100%", width: "100%" }}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={i === activeIndex ? 0 : -1}
                className="chip-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  background: isSelected ? "var(--accent-100)" : "transparent",
                  border: "none",
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)"
                }}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(o.value)}
              >
                <span>{o.label}</span>
                {isSelected ? <Check /> : null}
              </button>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
