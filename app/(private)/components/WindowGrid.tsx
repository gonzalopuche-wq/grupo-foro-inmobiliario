"use client";

import { useWindowManager } from "./WindowManager";

export default function WindowGrid({ onClose }: { onClose: () => void }) {
  const { windows, focusWindow, closeWindow, restoreWindow } = useWindowManager();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 8998,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(10px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20, padding: 32,
      }}
    >
      <div style={{
        fontFamily: "'Montserrat',sans-serif", fontWeight: 800,
        fontSize: 11, color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.18em", textTransform: "uppercase",
      }}>
        Ventanas abiertas — {windows.length}
      </div>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12, maxWidth: 860, width: "100%",
        }}
      >
        {windows.map(win => (
          <div
            key={win.id}
            onClick={() => { restoreWindow(win.id); focusWindow(win.id); onClose(); }}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 8, overflow: "hidden",
              cursor: "pointer", transition: "border-color 0.15s",
              position: "relative",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(200,0,0,0.4)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
          >
            {/* Preview */}
            <div style={{
              height: 108, background: "#0a0a0a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40, opacity: win.minimized ? 0.35 : 1,
            }}>
              {win.icon}
            </div>

            {/* Footer */}
            <div style={{
              padding: "7px 10px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
            }}>
              <span style={{
                fontSize: 11, fontFamily: "'Inter',sans-serif",
                color: "rgba(255,255,255,0.65)", fontWeight: 500,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {win.title}
              </span>
              <button
                onClick={e => { e.stopPropagation(); closeWindow(win.id); }}
                style={{
                  background: "none", border: "none",
                  color: "rgba(255,255,255,0.25)", cursor: "pointer",
                  fontSize: 15, padding: "0 2px", lineHeight: 1, flexShrink: 0,
                }}
                title="Cerrar"
              >
                ×
              </button>
            </div>

            {win.minimized && (
              <div style={{
                position: "absolute", top: 6, left: 6,
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 3, padding: "1px 5px",
                fontSize: 8, color: "#f59e0b",
                fontFamily: "'Montserrat',sans-serif", fontWeight: 700,
                letterSpacing: "0.08em",
              }}>
                MIN
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        fontSize: 11, color: "rgba(255,255,255,0.18)",
        fontFamily: "'Inter',sans-serif", marginTop: 4,
      }}>
        Clic en el fondo para cerrar
      </div>
    </div>
  );
}
