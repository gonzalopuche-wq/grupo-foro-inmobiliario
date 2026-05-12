"use client";

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, Arial, sans-serif",
      padding: "0 24px",
    }}>
      <img
        src="/logo_gfi.png"
        alt="GFI"
        style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 24, opacity: 0.85 }}
      />
      <h1 style={{
        color: "#fff", fontFamily: "Montserrat, sans-serif",
        fontSize: 20, fontWeight: 800, margin: "0 0 8px", textAlign: "center",
      }}>
        Sin conexión
      </h1>
      <p style={{
        color: "rgba(255,255,255,0.4)", fontSize: 13,
        margin: "0 0 32px", textAlign: "center", maxWidth: 280, lineHeight: 1.6,
      }}>
        Verificá tu conexión a internet. Las secciones que visitaste recientemente están disponibles sin conexión.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "#cc0000", color: "#fff", border: "none",
          borderRadius: 6, padding: "12px 28px",
          fontSize: 13, fontWeight: 700,
          fontFamily: "Montserrat, sans-serif", cursor: "pointer",
          letterSpacing: "0.06em",
        }}
      >
        Reintentar
      </button>
      <p style={{
        marginTop: 40, fontSize: 10, color: "rgba(255,255,255,0.15)",
        fontFamily: "Montserrat, sans-serif", letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>
        GFI® Grupo Foro Inmobiliario
      </p>
    </div>
  );
}
