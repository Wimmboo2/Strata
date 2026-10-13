export default function Loading() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="skeleton skeleton-line" style={{ width: 280, height: 38, borderRadius: 14 }} />
      <div className="skeleton skeleton-line" style={{ width: 110, height: 26 }} />
      <div className="skeleton skeleton-line" style={{ width: 320, height: 40 }} />
      <div className="grid-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton skeleton-card">
            <div className="skeleton skeleton-line" style={{ width: 70, height: 10, marginBottom: 14 }} />
            <div className="skeleton skeleton-line" style={{ width: 48, height: 30, marginBottom: 16, borderRadius: 12 }} />
            <div className="skeleton skeleton-line" style={{ width: "85%", height: 12, marginBottom: 8 }} />
            <div className="skeleton skeleton-line" style={{ width: "55%", height: 12 }} />
          </div>
        ))}
      </div>
      {[0, 1].map((s) => (
        <div key={s} style={{ display: "grid", gap: 12 }}>
          <div className="skeleton skeleton-line" style={{ width: 160, height: 28, borderRadius: 10 }} />
          <div className="skeleton" style={{ padding: 0 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ padding: "14px 22px" }}>
                <div className="skeleton skeleton-line" style={{ width: "60%", height: 13, marginBottom: 8 }} />
                <div className="skeleton skeleton-line" style={{ width: 120, height: 11 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
