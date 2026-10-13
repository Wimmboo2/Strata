"use client";
import type { KeyboardEvent, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  function onCardClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, [role='menu']")) return;
    router.push("/projects/" + project.id);
  }

  function onCardKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && e.target === e.currentTarget) {
      router.push("/projects/" + project.id);
    }
  }

  return (
    <div
      className="card card-clickable"
      onClick={onCardClick}
      onKeyDown={onCardKey}
      role="link"
      tabIndex={0}
      style={{ cursor: "pointer" }}
    >
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
