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
      <div style={{ marginTop: 35, display: "grid", gap: 18 }}>
        <div className="feature-row" style={{ background: "#f0fae1", borderRadius: 28, padding: 26 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="dot" /><h2 style={{ fontSize: 25, margin: 0 }}>Statuses that stay honest</h2></div>
          <p style={{ margin: 0 }}>Every project is building, finished, or paused. Three states, no clutter, easy to scan.</p>
        </div>
        <div className="feature-row" style={{ background: "#fff2eb", borderRadius: 28, padding: 26 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="dot" /><h2 style={{ fontSize: 25, margin: 0 }}>Labels for your own map</h2></div>
          <p style={{ margin: 0 }}>Tag projects frontend, side-project, or ai. Labels stay scoped to your projects.</p>
        </div>
        <div className="feature-row" style={{ background: "#eee7db", borderRadius: 28, padding: 26 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="dot" /><h2 style={{ fontSize: 25, margin: 0 }}>Activity from public repos</h2></div>
          <p style={{ margin: 0 }}>Commits, pull requests, and issues are copied into Strata so pages load fast and history stays put.</p>
        </div>
      </div>
      <div className="tint-patch" style={{ marginTop: 35 }}>
        <h2>Start with one project</h2>
        <p>Register with email and your GitHub profile link, then link a public repo.</p>
        <p><a className="btn btn-primary" href="/register">Start tracking</a></p>
      </div>
    </div>
  );
}
