"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export function CountUp({
  value,
  className,
  style,
  duration = 900
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = shownRef.current;
    if (reduce || from === value || duration <= 0) {
      shownRef.current = value;
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const span = value - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + span * eased);
      shownRef.current = next;
      setDisplay(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        shownRef.current = value;
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}
