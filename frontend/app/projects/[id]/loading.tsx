export default function Loading() {
  return (
    <div>
      <p className="kicker">Loading</p>
      <h1>Project</h1>
      <div className="grid-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card">
            <div className="card-title">Loading</div>
          </div>
        ))}
      </div>
    </div>
  );
}
