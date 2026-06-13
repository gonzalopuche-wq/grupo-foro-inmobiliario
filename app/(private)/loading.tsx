export default function Loading() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 32, height: 32, border: "2px solid rgba(153,0,0,0.2)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Cargando…
        </div>
      </div>
    </div>
  );
}
