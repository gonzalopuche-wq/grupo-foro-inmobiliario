"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

export default function SecurityGuard({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = useState("");
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const date = new Date().toLocaleDateString("es-AR");
      setLabel(`GFI CONFIDENCIAL · ${email} · ${date}`);
    });

    // ── 1. Bloqueo de menú contextual (clic derecho) ──────────────────────
    const blockCtx = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", blockCtx);

    // ── 2. Bloqueo de teclas sensibles ────────────────────────────────────
    const blockKeys = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toUpperCase();

      if (e.key === "F12") { e.preventDefault(); e.stopPropagation(); return; }

      // DevTools: Ctrl+Shift+I / J / C
      if (ctrl && e.shiftKey && ["I", "J", "C"].includes(k)) {
        e.preventDefault(); e.stopPropagation(); return;
      }

      // Ver código fuente: Ctrl+U
      if (ctrl && k === "U") { e.preventDefault(); e.stopPropagation(); return; }

      // Guardar página: Ctrl+S
      if (ctrl && k === "S") { e.preventDefault(); e.stopPropagation(); return; }

      // Imprimir: Ctrl+P
      if (ctrl && k === "P") { e.preventDefault(); e.stopPropagation(); return; }

      // Copiar / Cortar
      if (ctrl && (k === "C" || k === "X")) {
        const sel = window.getSelection()?.toString() ?? "";
        // Permitir copiar solo desde inputs/textareas
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (!["INPUT", "TEXTAREA"].includes(tag)) {
          e.preventDefault(); e.stopPropagation();
        }
        return;
      }
    };
    document.addEventListener("keydown", blockKeys, true);

    // ── 3. Bloqueo de eventos del portapapeles fuera de inputs ─────────────
    const blockClip = (e: ClipboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (!["INPUT", "TEXTAREA"].includes(tag)) e.preventDefault();
    };
    document.addEventListener("copy", blockClip);
    document.addEventListener("cut", blockClip);

    // ── 4. Bloqueo de arrastre de texto/elementos ──────────────────────────
    const blockDrag = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragstart", blockDrag);

    // ── 5. Bloqueo de impresión (ventana de impresión del navegador) ───────
    const origPrint = window.print.bind(window);
    (window as Window).print = () => {
      // No-op: impresión deshabilitada por política de seguridad
    };
    const beforePrint = (e: Event) => e.stopImmediatePropagation();
    window.addEventListener("beforeprint", beforePrint);

    // ── 6. CSS: user-select none + @media print oculta todo ───────────────
    const style = document.createElement("style");
    style.id = "__gfi_sec";
    style.textContent = [
      "* { user-select: none !important; -webkit-user-select: none !important; }",
      "input, textarea, [contenteditable='true'] { user-select: text !important; -webkit-user-select: text !important; }",
      "@media print { html, body { display: none !important; visibility: hidden !important; } }",
    ].join("\n");
    document.head.appendChild(style);

    // ── 7. Timeout por inactividad: cierra sesión a los 30 minutos ─────────
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace("/login?motivo=inactividad");
      }, INACTIVITY_MS);
    };
    const actEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;
    actEvents.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      document.removeEventListener("contextmenu", blockCtx);
      document.removeEventListener("keydown", blockKeys, true);
      document.removeEventListener("copy", blockClip);
      document.removeEventListener("cut", blockClip);
      document.removeEventListener("dragstart", blockDrag);
      (window as Window).print = origPrint;
      window.removeEventListener("beforeprint", beforePrint);
      document.getElementById("__gfi_sec")?.remove();
      actEvents.forEach(ev => document.removeEventListener(ev, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return (
    <>
      {/* Marca de agua invisible — trazable en capturas ─────────────────── */}
      {label && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            pointerEvents: "none",
            overflow: "hidden",
            userSelect: "none",
          }}
        >
          {Array.from({ length: 42 }).map((_, i) => {
            const col = i % 6;
            const row = Math.floor(i / 6);
            return (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: `${col * 18 - 2}%`,
                  top: `${row * 16 - 2}%`,
                  transform: "rotate(-32deg)",
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "#000",
                  opacity: 0.055,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
      {children}
    </>
  );
}
