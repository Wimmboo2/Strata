"use client";
import Link from "next/link";
import type { Project, ProjectStatus } from "../lib/types";
import { StatusPicker } from "./StatusPicker";

export function ProjectCard({
  project,
  editable,
  onStatusChange
}: {
  project: Project;
  editable: boolean;
  onStatusChange?: (next: ProjectStatus) => void;
}) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginTop: 0 }}>
        <Link href={"/projects/" + project.id}>{project.name}</Link>
      </div>
      {project.description ? <p className="card-body">{project.description}</p> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <StatusPicker projectId={project.id} status={project.status} editable={editable} onChange={onStatusChange} />
      </div>
    </div>
  );
}
