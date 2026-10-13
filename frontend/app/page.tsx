export default function Home() {
  return (
    <div>
      <p className="kicker">Personal project tracker</p>
      <h1>
        <span style={{ display: "block" }}>Keep every project</span>
        <span style={{ display: "block" }}>on one warm shelf.</span>
      </h1>
      <p>Strata tracks status, labels, and live activity from public GitHub repos in one calm place.</p>
      <p>
        <a className="btn btn-primary" href="/projects">Browse projects</a>{" "}
        <a className="btn btn-secondary" href="/register">Start tracking</a>
      </p>
      <div style={{ marginTop: 35 }}>
        <div className="feature-row">
          <div><span className="dot" /><h2>Statuses that stay honest</h2></div>
          <p>Every project is building, finished, or paused. Three states, no clutter, easy to scan.</p>
        </div>
        <div className="feature-row">
          <div><span className="dot" /><h2>Labels for your own map</h2></div>
          <p>Tag projects frontend, side-project, or ai. Labels stay scoped to your projects.</p>
        </div>
        <div className="feature-row">
          <div><span className="dot" /><h2>Activity from public repos</h2></div>
          <p>Commits, pull requests, and issues are copied into Strata so pages load fast and history stays put.</p>
        </div>
      </div>
      <div className="tint-patch" style={{ marginTop: 35 }}>
        <h2>Start with one project</h2>
        <p>Register with email and your GitHub profile link, then link a public repo.</p>
        <p><a className="btn btn-primary" href="/register">Create account</a></p>
      </div>
    </div>
  );
}
