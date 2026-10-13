"use client";
import type { ProjectStatus } from "../lib/types";
import { PROJECT_STATUSES } from "../lib/types";

export function FilterBar({
  status,
  label,
  onStatus,
  onLabel
}: {
  status: ProjectStatus | "";
  label: string;
  onStatus: (v: ProjectStatus | "") => void;
  onLabel: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <select value={status} onChange={(e) => onStatus(e.target.value as ProjectStatus | "")}>
        <option value="">All statuses</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input placeholder="Filter by label" value={label} onChange={(e) => onLabel(e.target.value)} />
    </div>
  );
}
