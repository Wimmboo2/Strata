import type { ProjectStatus } from "../../../lib/types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span style={{ border: "1px solid #ccc", borderRadius: 4, padding: "2px 8px" }}>{status}</span>;
}
