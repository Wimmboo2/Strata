export type ProjectStatus = "building" | "finished" | "paused";

export const PROJECT_STATUSES: ProjectStatus[] = ["building", "finished", "paused"];

export interface Profile {
  id: string;
  display_name: string | null;
  github_profile_url: string;
  github_username: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  project_id: string;
  name: string;
}

export interface ProjectRepo {
  id: string;
  project_id: string;
  repo_full_name: string;
  installation_id: number | null;
  created_at: string;
}

export interface CommitItem {
  id: string;
  project_repo_id: string;
  github_sha: string;
  message: string;
  author_login: string | null;
  url: string;
  committed_at: string;
}

export interface PullRequestItem {
  id: string;
  project_repo_id: string;
  github_number: number;
  title: string;
  state: string;
  author_login: string | null;
  url: string;
  updated_at_github: string;
}

export interface IssueItem {
  id: string;
  project_repo_id: string;
  github_number: number;
  title: string;
  state: string;
  author_login: string | null;
  url: string;
  updated_at_github: string;
}

export type ActivityItem =
  | { kind: "commit"; at: string; data: CommitItem }
  | { kind: "pull_request"; at: string; data: PullRequestItem }
  | { kind: "issue"; at: string; data: IssueItem };

export function parseGithubUsername(profileUrl: string): string | null {
  try {
    const u = new URL(profileUrl);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0] : null;
  } catch {
    return null;
  }
}

export function normalizeRepoFullName(fullName: string): string | null {
  const trimmed = fullName.trim().toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(trimmed)) return null;
  return trimmed;
}
