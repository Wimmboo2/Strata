import Link from "next/link";
import type { Project } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

export function ProjectCard({ project, labels }: { project: Project; labels: string[] }) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href={`/projects/${project.id}`}>
          <strong>{project.name}</strong>
        </Link>
        <StatusBadge status={project.status} />
      </div>
      <p>{project.description}</p>
      <div style={{ display: "flex", gap: 8 }}>
        {labels.map((l) => (
          <span key={l} style={{ background: "#f2f2f2", borderRadius: 4, padding: "2px 6px" }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
