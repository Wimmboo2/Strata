import type { ProjectStatus } from "../lib/types";

const tone: Record<ProjectStatus, string> = {
  building: "tag-accent",
  finished: "tag-accent-2",
  paused: "tag-neutral"
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`tag ${tone[status]}`}>{status}</span>;
}
