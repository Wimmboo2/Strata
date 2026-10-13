interface FeedProps {
  commits: { github_sha: string; message: string; author_login: string | null; url: string; committed_at: string }[];
  pulls: { github_number: number; title: string; state: string; url: string; updated_at_github: string }[];
  issues: { github_number: number; title: string; state: string; url: string; updated_at_github: string }[];
}

export function ActivityFeed({ commits, pulls, issues }: FeedProps) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h3>Commits</h3>
        {commits.length === 0 ? <p>No commits yet.</p> : null}
        <ul>
          {commits.map((c) => (
            <li key={c.github_sha}>
              <a href={c.url}>{c.message.split("\n")[0]}</a> {c.author_login ? `by ${c.author_login}` : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Pull requests</h3>
        {pulls.length === 0 ? <p>No pull requests yet.</p> : null}
        <ul>
          {pulls.map((p) => (
            <li key={p.github_number}>
              <a href={p.url}>
                #{p.github_number} {p.title}
              </a>{" "}
              [{p.state}]
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Issues</h3>
        {issues.length === 0 ? <p>No issues yet.</p> : null}
        <ul>
          {issues.map((i) => (
            <li key={i.github_number}>
              <a href={i.url}>
                #{i.github_number} {i.title}
              </a>{" "}
              [{i.state}]
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
