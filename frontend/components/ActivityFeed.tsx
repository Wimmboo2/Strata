interface FeedProps {
  commits: { github_sha: string; message: string; author_login: string | null; url: string; committed_at: string }[];
  pulls: { github_number: number; title: string; state: string; url: string; updated_at_github: string }[];
  issues: { github_number: number; title: string; state: string; url: string; updated_at_github: string }[];
}

export function ActivityFeed({ commits, pulls, issues }: FeedProps) {
  return (
    <div className="grid-3">
      <section className="card">
        <div className="card-kicker">Commits</div>
        <div className="card-title">Latest pushes</div>
        {commits.length === 0 ? <p className="card-body">No commits yet.</p> : (
          <ul>{commits.map((c) => (<li key={c.github_sha}><a href={c.url}>{c.message.split("\n")[0]}</a></li>))}</ul>
        )}
      </section>
      <section className="card">
        <div className="card-kicker">Pull requests</div>
        <div className="card-title">Reviews in flight</div>
        {pulls.length === 0 ? <p className="card-body">No pull requests yet.</p> : (
          <ul>{pulls.map((p) => (<li key={p.github_number}><a href={p.url}>#{p.github_number} {p.title}</a> <span className="tag tag-neutral">{p.state}</span></li>))}</ul>
        )}
      </section>
      <section className="card">
        <div className="card-kicker">Issues</div>
        <div className="card-title">Open questions</div>
        {issues.length === 0 ? <p className="card-body">No issues yet.</p> : (
          <ul>{issues.map((i) => (<li key={i.github_number}><a href={i.url}>#{i.github_number} {i.title}</a> <span className="tag tag-neutral">{i.state}</span></li>))}</ul>
        )}
      </section>
    </div>
  );
}
