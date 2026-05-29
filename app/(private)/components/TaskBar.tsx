"use client";

import { useState } from "react";
import { useWindowManager } from "./WindowManager";
import WindowGrid from "./WindowGrid";

export default function TaskBar() {
  const { windows, focusWindow, minimizeWindow, restoreWindow, closeWindow } = useWindowManager();
  const [showGrid, setShowGrid] = useState(false);

  return (
    <>
      {showGrid && <WindowGrid onClose={() => setShowGrid(false)} />}

      <div style={{
        position: "fixed", bottom: 0, left: 220, right: 0,
        height: 44, zIndex: 8999,
        background: "rgba(6,6,6,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center",
        padding: "0 10px", gap: 5,
      }}>
        <style>{`
          @media (max-width: 900px) { .__gfi_taskbar_wrap { display: none !important; } }
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

        {windows.length === 0 && (
          <span style={{
            fontSize: 11, color: "rgba(255,255,255,0.2)",
            fontFamily: "'Inter',sans-serif", paddingLeft: 4,
            userSelect: "none",
          }}>
            Hover sobre un módulo del menú y hacé clic en ⊞ para abrirlo en ventana flotante
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Botón grilla */}
        <button
          onClick={() => setShowGrid(s => !s)}
          title="Ver todas las ventanas (grilla)"
          style={{
            height: 32, padding: "0 12px", borderRadius: 5,
            background: showGrid ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${showGrid ? "rgba(200,0,0,0.3)" : "rgba(255,255,255,0.09)"}`,
            color: showGrid ? "#cc0000" : "rgba(255,255,255,0.45)",
            cursor: "pointer", fontSize: 11,
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: "'Montserrat',sans-serif", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            flexShrink: 0, transition: "all 0.15s",
          }}
        >
          <span style={{ fontSize: 16 }}>⊞</span>
          {windows.length > 0 && <span>{windows.length} ventana{windows.length !== 1 ? "s" : ""}</span>}
        </button>
      </div>
    </>
  );
}
