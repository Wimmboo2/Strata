export default function Loading() {
  return (
    <div>
      <div className="skeleton skeleton-line" style={{ width: 120, height: 13, marginBottom: 16 }} />
      <div className="skeleton skeleton-line" style={{ width: 220, height: 38, marginBottom: 22, borderRadius: 14 }} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton skeleton-card">
            <div className="skeleton skeleton-line" style={{ width: 70, height: 10, marginBottom: 14 }} />
            <div className="skeleton skeleton-line" style={{ width: 48, height: 30, borderRadius: 12 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <div className="skeleton skeleton-line" style={{ width: 260, height: 40 }} />
        <div className="skeleton skeleton-line" style={{ width: 200, height: 40 }} />
        <div className="skeleton skeleton-line" style={{ width: 190, height: 40 }} />
      </div>
      <div className="grid-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton skeleton-card">
            <div className="skeleton skeleton-line" style={{ width: "55%", height: 20, marginBottom: 16, borderRadius: 10 }} />
            <div className="skeleton skeleton-line" style={{ width: "80%", height: 12, marginBottom: 8 }} />
            <div className="skeleton skeleton-line" style={{ width: "60%", height: 12, marginBottom: 18 }} />
            <div className="skeleton skeleton-line" style={{ width: 86, height: 24 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
