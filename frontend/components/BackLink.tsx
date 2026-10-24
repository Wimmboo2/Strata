import Link from "next/link";

function ArrowLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "inline-flex" }}
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/**
 * Back link to the dashboard, shown on detail pages so the user always has
 * a way out that does not depend on the browser's back button.
 */
export function BackLink({ href = "/projects", label = "Back to projects" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="btn-ghost"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 0",
        marginBottom: 4,
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 600
      }}
    >
      <ArrowLeft />
      {label}
    </Link>
  );
}
