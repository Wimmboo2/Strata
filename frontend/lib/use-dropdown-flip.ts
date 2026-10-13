"use client";
import { useRef, useState } from "react";

/**
 * Flip a dropdown above its trigger when there is not enough room below.
 * Returns a ref for the wrapper element, the `up` flag, and a `toggle` helper
 * that measures before opening.
 */
export function useDropdownFlip<T extends HTMLElement>(neededPx = 280) {
  const ref = useRef<T>(null);
  const [up, setUp] = useState(false);

  function measure() {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setUp(spaceBelow < neededPx);
  }

  return { ref, up, measure };
}
