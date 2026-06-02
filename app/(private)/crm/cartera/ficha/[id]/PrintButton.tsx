"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding: "8px 18px", background: "#990000", border: "none", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer", letterSpacing: "0.06em" }}
    >
      🖨 Imprimir / PDF
    </button>
  );
}
