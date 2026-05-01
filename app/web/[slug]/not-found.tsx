export default function NotFound() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: "#cc0000", fontFamily: "Montserrat,sans-serif", marginBottom: 16 }}>404</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "Montserrat,sans-serif", marginBottom: 8 }}>Sitio no disponible</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", maxWidth: 340, lineHeight: 1.6 }}>
          El corredor que buscás no tiene un sitio web activo en GFI® o la URL no es correcta.
        </p>
        <div style={{ marginTop: 48, fontSize: 11, color: "rgba(255,255,255,0.15)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em" }}>
          GFI® GRUPO FORO INMOBILIARIO
        </div>
      </div>
    </>
  );
}
