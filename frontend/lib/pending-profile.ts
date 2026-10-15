export const PENDING_PROFILE_KEY = "strata-pending-profile";

export function githubUsernameFromUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0] : null;
  } catch {
    return null;
  }
}

export function readPendingProfile(): { githubUrl: string; displayName: string | null } | null {
  try {
    const raw = localStorage.getItem(PENDING_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { githubUrl?: unknown; displayName?: unknown };
    if (typeof parsed.githubUrl !== "string" || !parsed.githubUrl) return null;
    return {
      githubUrl: parsed.githubUrl,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : null
    };
  } catch {
    return null;
  }
}

export function clearPendingProfile(): void {
  try {
    localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch {
    // Storage unavailable; the pending entry simply stays unread.
  }
}
