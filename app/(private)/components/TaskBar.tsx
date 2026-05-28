"use client";

import { useState } from "react";
import { useWindowManager } from "./WindowManager";
import WindowGrid from "./WindowGrid";

export default function TaskBar() {
  const { windows, focusWindow, minimizeWindow, restoreWindow, closeWindow } = useWindowManager();
  const [showGrid, setShowGrid] = useState(false);

  if (windows.length === 0) return null;

  return (
    <>
      {showGrid && <WindowGrid onClose={() => setShowGrid(false)} />}

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: 48, zIndex: 8999,
        background: "rgba(6,6,6,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center",
        padding: "0 10px", gap: 5,
        // Solo escritorio
      }}>
        <style>{`
          @media (max-width: 900px) { .__gfi_taskbar { display: none !important; } }
        `}</style>

        {/* Ventanas abiertas */}
        {windows.map(win => (
          <button
            key={win.id}
            onClick={() => win.minimized ? restoreWindow(win.id) : focusWindow(win.id)}
            onContextMenu={e => { e.preventDefault(); closeWindow(win.id); }}
            title={`${win.title}${win.minimized ? " (minimizada)" : ""} — clic der. para cerrar`}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px",
              background: win.minimized
                ? "rgba(255,255,255,0.04)"
                : "rgba(200,0,0,0.1)",
              border: `1px solid ${win.minimized ? "rgba(255,255,255,0.07)" : "rgba(200,0,0,0.28)"}`,
              borderRadius: 5, cursor: "pointer",
              color: win.minimized ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.82)",
              fontSize: 11, fontFamily: "'Inter',sans-serif", fontWeight: 500,
              maxWidth: 150, overflow: "hidden",
              transition: "all 0.12s", flexShrink: 0,
              height: 32,
            }}
          >
            <span style={{ fontSize: 12, flexShrink: 0 }}>{win.icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {win.title}
            </span>
            {/* Punto activo */}
            {!win.minimized && (
              <span style={{
                width: 4, height: 4, borderRadius: "50%",
                background: "#cc0000", flexShrink: 0, marginLeft: 2,
              }} />
            )}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Botón grilla */}
        <button
          onClick={() => setShowGrid(s => !s)}
          title="Ver todas las ventanas (grilla)"
          style={{
            width: 36, height: 36, borderRadius: 6,
            background: showGrid ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${showGrid ? "rgba(200,0,0,0.3)" : "rgba(255,255,255,0.09)"}`,
            color: showGrid ? "#cc0000" : "rgba(255,255,255,0.5)",
            cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.15s",
          }}
        >
          ⊞
        </button>
      </div>
    </>
  );
}
