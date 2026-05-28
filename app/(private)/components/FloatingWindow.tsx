"use client";

import { useRef } from "react";
import { GFIWindow, useWindowManager } from "./WindowManager";

const BTN: React.CSSProperties = {
  width: 14, height: 14, borderRadius: "50%", border: "none",
  cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: 10, fontWeight: 700,
  color: "rgba(0,0,0,0.55)", padding: 0, flexShrink: 0, lineHeight: 1,
};

export default function FloatingWindow({ win }: { win: GFIWindow }) {
  const { closeWindow, focusWindow, minimizeWindow, updateWindow } = useWindowManager();
  const dragRef = useRef<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);
  const maxRef = useRef(false);
  const prevRef = useRef({ x: win.x, y: win.y, width: win.width, height: win.height });

  if (win.minimized) return null;

  const onTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, wx: win.x, wy: win.y };
    focusWindow(win.id);
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      updateWindow(win.id, {
        x: Math.max(0, dragRef.current.wx + ev.clientX - dragRef.current.sx),
        y: Math.max(0, dragRef.current.wy + ev.clientY - dragRef.current.sy),
      });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: win.width, sh: win.height };
    const move = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      updateWindow(win.id, {
        width: Math.max(400, resizeRef.current.sw + ev.clientX - resizeRef.current.sx),
        height: Math.max(280, resizeRef.current.sh + ev.clientY - resizeRef.current.sy),
      });
    };
    const up = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const toggleMax = () => {
    if (maxRef.current) {
      updateWindow(win.id, prevRef.current);
      maxRef.current = false;
    } else {
      prevRef.current = { x: win.x, y: win.y, width: win.width, height: win.height };
      updateWindow(win.id, { x: 220, y: 0, width: window.innerWidth - 220, height: window.innerHeight - 48 });
      maxRef.current = true;
    }
  };

  const src = `${win.href}${win.href.includes("?") ? "&" : "?"}ventana=1`;

  return (
    <div
      onMouseDown={() => focusWindow(win.id)}
      style={{
        position: "fixed", left: win.x, top: win.y,
        width: win.width, height: win.height,
        zIndex: win.zIndex,
        background: "#111",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Barra de título */}
      <div
        onMouseDown={onTitleMouseDown}
        onDoubleClick={toggleMax}
        style={{
          height: 36, flexShrink: 0,
          background: "rgba(16,16,16,0.99)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center",
          padding: "0 10px", gap: 8, cursor: "grab",
        }}
      >
        {/* Controles macOS-style */}
        <button onClick={() => closeWindow(win.id)} style={{ ...BTN, background: "#ef4444" }} title="Cerrar">×</button>
        <button onClick={() => minimizeWindow(win.id)} style={{ ...BTN, background: "#f59e0b" }} title="Minimizar">−</button>
        <button onClick={toggleMax} style={{ ...BTN, background: "#22c55e" }} title="Maximizar">+</button>

        <span style={{ fontSize: 13, marginLeft: 4 }}>{win.icon}</span>
        <span style={{
          flex: 1, fontSize: 12, fontFamily: "'Inter',sans-serif",
          color: "rgba(255,255,255,0.65)", fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {win.title}
        </span>
      </div>

      {/* Contenido */}
      <iframe
        src={src}
        style={{ flex: 1, border: "none", background: "#0a0a0a", display: "block" }}
        title={win.title}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
      />

      {/* Handle de resize */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: "absolute", bottom: 0, right: 0,
          width: 18, height: 18, cursor: "nwse-resize",
          background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.12) 50%)",
          borderRadius: "0 0 7px 0",
        }}
      />
    </div>
  );
}
