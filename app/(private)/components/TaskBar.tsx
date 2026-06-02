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
        position: "fixed", bottom: 0, left: 240, right: 0,
        height: 44, zIndex: 8999,
        background: "rgba(8,10,12,0.96)",
        borderTop: "1px solid #1c2030",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex", alignItems: "center",
        padding: "0 12px", gap: 4,
      }}>
        <style>{`
          @media (max-width: 900px) { .__gfi_taskbar_wrap { display: none !important; } }
          .gfi-taskbar-win-btn {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 10px; border-radius: 6px;
            font-family: var(--font-body); font-size: 11px; font-weight: 500;
            max-width: 155px; overflow: hidden;
            transition: all 0.12s; flex-shrink: 0;
            height: 30px; cursor: pointer; position: relative;
          }
          .gfi-taskbar-win-btn:hover { transform: translateY(-1px); }
          .gfi-taskbar-win-btn .tb-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .gfi-taskbar-win-btn .tb-indicator {
            position: absolute; bottom: -1px; left: 50%; transform: translateX(-50%);
            width: 16px; height: 2px; border-radius: 2px; background: #990000;
            box-shadow: 0 0 6px rgba(153,0,0,0.6);
          }
        `}</style>

        {/* Ventanas abiertas */}
        {windows.map(win => (
          <button
            key={win.id}
            onClick={() => win.minimized ? restoreWindow(win.id) : focusWindow(win.id)}
            onContextMenu={e => { e.preventDefault(); closeWindow(win.id); }}
            title={`${win.title}${win.minimized ? " (minimizada)" : ""} — clic der. para cerrar`}
            className="gfi-taskbar-win-btn"
            style={{
              background: win.minimized ? "var(--gfi-border-subtle)" : "rgba(153,0,0,0.10)",
              border: `1px solid ${win.minimized ? "#252a35" : "rgba(153,0,0,0.28)"}`,
              color: win.minimized ? "#4a5568" : "#f0f4f8",
            }}
          >
            <span style={{ fontSize: 13, flexShrink: 0 }}>{win.icon}</span>
            <span className="tb-label">{win.title}</span>
            {!win.minimized && <span className="tb-indicator" />}
          </button>
        ))}

        {windows.length === 0 && (
          <span style={{
            fontSize: 10, color: "#2d3748",
            fontFamily: "var(--font-body)", paddingLeft: 4,
            userSelect: "none", letterSpacing: "0.03em",
          }}>
            Hover sobre un módulo y hacé clic en ⊞ para abrirlo en ventana flotante
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Botón grilla */}
        <button
          onClick={() => setShowGrid(s => !s)}
          title="Ver todas las ventanas"
          style={{
            height: 30, padding: "0 12px", borderRadius: 6,
            background: showGrid ? "rgba(153,0,0,0.12)" : "var(--gfi-border-subtle)",
            border: `1px solid ${showGrid ? "rgba(153,0,0,0.30)" : "#252a35"}`,
            color: showGrid ? "#990000" : "#8892a4",
            cursor: "pointer", fontSize: 11,
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-display)", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            flexShrink: 0, transition: "all 0.15s",
          }}
          onMouseEnter={e => { if (!showGrid) { e.currentTarget.style.color = "#f0f4f8"; e.currentTarget.style.borderColor = "#333b4d"; } }}
          onMouseLeave={e => { if (!showGrid) { e.currentTarget.style.color = "#8892a4"; e.currentTarget.style.borderColor = "#252a35"; } }}
        >
          <span style={{ fontSize: 15 }}>⊞</span>
          {windows.length > 0 && <span>{windows.length}</span>}
        </button>
      </div>
    </>
  );
}
