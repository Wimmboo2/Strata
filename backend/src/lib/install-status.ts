import { getAdminClient } from "./supabase-admin";
import { listAppInstallations, mintInstallationToken, type AppInstallation } from "./github-app";
import { isValidRepoFullName, normalizeRepoFullName } from "./urls";

export interface InstallStatus {
  /**
   * True when every tracked repo is covered by a GitHub App installation,
   * which is exactly when webhook updates reach every repo.
   */
  enabled: boolean;
  /** How many tracked repos receive webhook updates. */
  covered: number;
  /** How many repos are tracked in total. */
  total: number;
  /** GitHub accounts that own the covered repos. */
  accounts: string[];
}

const CACHE_TTL_MS = 30_000;
const statusCache = new Map<string, { at: number; status: InstallStatus }>();
const selectedRepoCache = new Map<number, { at: number; names: Set<string> }>();

/**
 * Drop cached status.
 *
 * Called after a successful install so the dashboard reflects the new
 * installation immediately instead of serving a stale "not enabled" answer
 * for up to the cache lifetime.
 */
export function clearInstallStatusCache(): void {
  statusCache.clear();
  selectedRepoCache.clear();
}

/**
 * Report whether instant (webhook) updates are active for a user's repos.
 *
 * The source of truth is GitHub itself: the App has to be installed on the
 * account that owns each repo, and the installation has to cover that
 * specific repo. The local installation table is not consulted, because it
 * records which Strata profile owns an installation rather than whether
 * webhooks are flowing.
 */
export async function getInstallStatus(userId: string): Promise<InstallStatus> {
  const now = Date.now();
  const cached = statusCache.get(userId);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.status;

  const status = await computeInstallStatus(userId);
  statusCache.set(userId, { at: now, status });
  return status;
}

async function computeInstallStatus(userId: string): Promise<InstallStatus> {
  const supabase = getAdminClient();

  const { data: projects } = await supabase.from("projects").select("id").eq("owner_id", userId);
  const projectIds = (projects ?? []).map((p) => p.id as string);
  if (projectIds.length === 0) return { enabled: false, covered: 0, total: 0, accounts: [] };

  const { data: repos } = await supabase
    .from("project_repos")
    .select("repo_full_name")
    .in("project_id", projectIds);
  const repoNames = (repos ?? [])
    .map((r) => r.repo_full_name)
    .filter(isValidRepoFullName)
    .map(normalizeRepoFullName);
  const total = repoNames.length;
  if (total === 0) return { enabled: false, covered: 0, total: 0, accounts: [] };

  const installations = await listAppInstallations();
  const byOwner = new Map<string, AppInstallation[]>();
  for (const installation of installations) {
    const key = installation.account_login.toLowerCase();
    const list = byOwner.get(key);
    if (list) list.push(installation);
    else byOwner.set(key, [installation]);
  }

  let covered = 0;
  const accounts: string[] = [];
  for (const fullName of repoNames) {
    const owner = fullName.split("/")[0].toLowerCase();
    const candidates = byOwner.get(owner);
    if (!candidates || candidates.length === 0) continue;
    if (await repoCovered(fullName, candidates)) {
      covered += 1;
      if (!accounts.includes(owner)) accounts.push(owner);
    }
  }

  return { enabled: covered === total, covered, total, accounts };
}

/**
 * Is this one repo covered by any of the installations on its account?
 *
 * An installation with repository_selection "all" covers every repo of the
 * account. One with "selected" covers only the repos it was granted, so
 * those are listed and matched.
 */
async function repoCovered(fullName: string, installations: AppInstallation[]): Promise<boolean> {
  for (const installation of installations) {
    if (installation.repository_selection === "all") return true;
    const names = await selectedRepos(installation.id);
    if (names && names.has(fullName)) return true;
  }
  return false;
}

/** Repos an installation was granted, when it was granted a selection. */
async function selectedRepos(installationId: number): Promise<Set<string> | null> {
  const now = Date.now();
  const cached = selectedRepoCache.get(installationId);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.names;

  const token = await mintInstallationToken(installationId);
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/installation/repositories?per_page=100", {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "User-Agent": "strata-app"
      }
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { repositories?: { full_name?: unknown }[] };
    const names = new Set<string>();
    for (const repo of body.repositories ?? []) {
      if (typeof repo.full_name === "string" && isValidRepoFullName(repo.full_name)) {
        names.add(normalizeRepoFullName(repo.full_name));
      }
    }
    selectedRepoCache.set(installationId, { at: now, names });
    return names;
  } catch {
    return null;
  }
}
