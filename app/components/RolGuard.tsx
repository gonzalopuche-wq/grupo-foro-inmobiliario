// app/components/RolGuard.tsx
// ═══════════════════════════════════════════════════════════════════════════
// GFI® — Componente de protección por rol
//
// Uso básico (módulo):
//   <RolGuard modulo="admin">
//     <AdminPage />
//   </RolGuard>
//
// Uso por acción:
//   <RolGuard accion="noticias:crear">
//     <button>Publicar noticia</button>
//   </RolGuard>
//
// Uso con fallback personalizado:
//   <RolGuard modulo="crm" fallback={<div>Sin acceso</div>}>
//     <CrmPage />
//   </RolGuard>
//
// Uso silencioso (solo renderiza si tiene permiso, nada si no):
//   <RolGuard accion="admin:ver_logs" silencioso>
//     <LogsWidget />
//   </RolGuard>
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useRol } from "../lib/useRol";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RolGuardProps {
  children: React.ReactNode;
  modulo?: string;
  accion?: string;
  fallback?: React.ReactNode;
  silencioso?: boolean;   // si true: no muestra nada en vez de mensaje de error
  redirigir?: string;     // ruta a redirigir si no tiene permiso (ej: "/dashboard")
}

export default function RolGuard({
  children,
  modulo,
  accion,
  fallback,
  silencioso = false,
  redirigir,
}: RolGuardProps) {
  const { rol, loading, puedeAcceder, puedeEjecutar } = useRol();
  const router = useRouter();

  const tienPermiso = accion
    ? puedeEjecutar(accion)
    : modulo
    ? puedeAcceder(modulo)
    : true;

  useEffect(() => {
    if (!loading && !tienPermiso && redirigir) {
      router.push(redirigir);
    }
  }, [loading, tienPermiso, redirigir, router]);

  if (loading) return null;

  if (!tienPermiso) {
    if (silencioso) return null;
    if (fallback) return <>{fallback}</>;
    if (redirigir) return null; // redirigiendo, no mostrar nada
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400&display=swap');
          .rol-guard-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 12px; }
          .rol-guard-icono { font-size: 40px; }
          .rol-guard-titulo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
          .rol-guard-titulo span { color: #cc0000; }
          .rol-guard-desc { font-size: 13px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; text-align: center; max-width: 320px; }
          .rol-guard-rol { font-size: 10px; color: rgba(255,255,255,0.15); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 8px; }
        `}</style>
        <div className="rol-guard-wrap">
          <div className="rol-guard-icono">🔒</div>
          <div className="rol-guard-titulo">Acceso <span>restringido</span></div>
          <div className="rol-guard-desc">
            No tenés permisos para acceder a este módulo.
            Si creés que es un error, contactá al administrador.
          </div>
          <div className="rol-guard-rol">Rol actual: {rol ?? "sin rol"}</div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
