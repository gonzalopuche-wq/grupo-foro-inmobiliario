import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500&display=swap');
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 80, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#cc0000", lineHeight: 1, marginBottom: 16 }}>404</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "Montserrat,sans-serif", marginBottom: 10 }}>Página no encontrada</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, maxWidth: 360, lineHeight: 1.6 }}>
          La página que buscás no existe o fue movida.
        </p>
        <Link href="/dashboard" style={{ display: "inline-block", padding: "11px 24px", background: "#cc0000", color: "#fff", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "Montserrat,sans-serif", textDecoration: "none" }}>
          Volver al dashboard
        </Link>
        <div style={{ marginTop: 48, fontSize: 11, color: "rgba(255,255,255,0.15)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em" }}>
          GFI® GRUPO FORO INMOBILIARIO
        </div>
      </div>
    </>
  );
}
