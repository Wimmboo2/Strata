import { safeGithubUrl } from "../lib/urls";

/**
 * Link that only renders as clickable when the href is a valid GitHub URL.
 * Anything else (javascript:, data:, other hosts, garbage) renders as plain
 * text, so rows already stored in the database can never become script sinks.
 */
export function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  const safe = safeGithubUrl(href);
  if (!safe) return <span>{children}</span>;
  return (
    <a href={safe} rel="noopener noreferrer">
      {children}
    </a>
  );
}
