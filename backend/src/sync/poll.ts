import "dotenv/config";
import { getAdminClient } from "../lib/supabase-admin";
import { syncRepo, type ProjectRepoRow } from "./repo-sync";

/**
 * Cron-driven poll across every tracked repo. Kept separate from the
 * per-user sync endpoint: this one runs unattended with no user context.
 */
export async function runPoll() {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("project_repos").select("id,repo_full_name");
  if (error) throw error;
  for (const repo of (data ?? []) as ProjectRepoRow[]) {
    try {
      await syncRepo(repo);
    } catch (err) {
      console.error(`Sync failed for ${repo.repo_full_name}`, err);
    }
  }
}

const isMain = process.argv[1]?.endsWith("poll.ts");
if (isMain) {
  runPoll()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
