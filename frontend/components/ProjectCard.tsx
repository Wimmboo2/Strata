import Link from "next/link";
import type { Project } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

export function ProjectCard({ project, labels }: { project: Project; labels: string[] }) {
  return (
    <div className="card">
      <div className="card-kicker">{project.status}</div>
      <div className="card-title">
        <Link href={`/projects/${project.id}`}>{project.name}</Link>
      </div>
      <p className="card-body">{project.description}</p>
      <div className="card-meta" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <StatusBadge status={project.status} />
        {labels.map((l) => (
          <span key={l} className="tag tag-neutral">{l}</span>
        ))}
      </div>
    </div>
  );
}
