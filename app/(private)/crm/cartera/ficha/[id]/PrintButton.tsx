"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding: "8px 18px", background: "#cc0000", border: "none", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: "pointer", letterSpacing: "0.06em" }}
    >
      🖨 Imprimir / PDF
    </button>
  );
}
