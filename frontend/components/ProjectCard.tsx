"use client";
import Link from "next/link";
import type { Project, ProjectStatus } from "../lib/types";
import { StatusPicker } from "./StatusPicker";
import { LabelChips } from "./LabelChips";

export function ProjectCard({
  project,
  labels,
  editable,
  suggestions,
  onLabelsChange,
  onStatusChange
}: {
  project: Project;
  labels: string[];
  editable: boolean;
  suggestions: string[];
  onLabelsChange?: (next: string[]) => void;
  onStatusChange?: (next: ProjectStatus) => void;
}) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginTop: 0 }}>
        <Link href={"/projects/" + project.id}>{project.name}</Link>
      </div>
      {project.description ? <p className="card-body">{project.description}</p> : null}
      <div className="card-meta" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <StatusPicker projectId={project.id} status={project.status} editable={editable} onChange={onStatusChange} />
        <LabelChips projectId={project.id} labels={labels} editable={editable} suggestions={suggestions} onChange={onLabelsChange} />
      </div>
    </div>
  );
}
