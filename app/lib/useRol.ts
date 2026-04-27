// app/lib/useRol.ts
// ═══════════════════════════════════════════════════════════════════════════
// GFI® — Hook de permisos por rol
// Uso: const { rol, isAdmin, puedeAcceder } = useRol()
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Rol =
  | "admin_general"
  | "admin_contenido"
  | "moderador"
  | "corredor"
  | "colaborador"
  | null;

// Permisos por módulo — qué roles tienen acceso
const PERMISOS: Record<string, Rol[]> = {
  // Todos los corredores con membresía activa
  dashboard:      ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  mir:            ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  comunidad:      ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  foro:           ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  noticias:       ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  calculadoras:   ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  comparables:    ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  padron:         ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  biblioteca:     ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  cotizaciones:   ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  enlaces:        ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  proveedores:    ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  eventos:        ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],
  perfil:         ["admin_general", "admin_contenido", "moderador", "corredor", "colaborador"],

  // CRM — privado del titular. Colaborador solo ve si el titular le dio acceso
  crm:            ["admin_general", "corredor"],

  // Mi Web — solo corredor titular
  "mi-web":       ["admin_general", "corredor"],

  // Admin — solo admins
  admin:          ["admin_general"],
  "admin-usuarios": ["admin_general"],
  "admin-contenido": ["admin_general", "admin_contenido"],
  "admin-noticias":  ["admin_general", "admin_contenido"],
  "admin-eventos":   ["admin_general", "admin_contenido"],
  "admin-biblioteca": ["admin_general", "admin_contenido"],
  "admin-comparables": ["admin_general"],
  "admin-suscripciones": ["admin_general"],
  "admin-logs":    ["admin_general"],
  moderacion:     ["admin_general", "moderador"],
};

// Permisos de acción dentro de módulos
export const ACCIONES: Record<string, Rol[]> = {
  // Noticias
  "noticias:crear":    ["admin_general", "admin_contenido"],
  "noticias:eliminar": ["admin_general"],

  // Biblioteca
  "biblioteca:subir":  ["admin_general", "admin_contenido", "corredor"],
  "biblioteca:eliminar": ["admin_general"],

  // Comparables
  "comparables:importar_excel": ["admin_general"],
  "comparables:exportar_excel": ["admin_general", "corredor"],

  // Eventos
  "eventos:crear":     ["admin_general", "admin_contenido"],

  // CRM
  "crm:exportar":      ["admin_general", "corredor"],

  // MIR
  "mir:publicar":      ["admin_general", "corredor"],
  "mir:urgente":       ["admin_general", "corredor"],  // badge urgente (pago)

  // Foro
  "foro:eliminar_mensaje": ["admin_general", "moderador"],
  "foro:destacar_respuesta": ["admin_general", "moderador"],

  // Admin
  "admin:ver_logs":    ["admin_general"],
  "admin:suspender_usuario": ["admin_general"],
  "admin:validar_matricula": ["admin_general"],
  "admin:configurar_bonificaciones": ["admin_general"],
};

export interface UseRolReturn {
  rol: Rol;
  loading: boolean;
  // Shortcuts
  isAdminGeneral: boolean;
  isAdminContenido: boolean;
  isModerador: boolean;
  isCorredor: boolean;
  isColaborador: boolean;
  isAdmin: boolean; // admin_general O admin_contenido
  // Funciones
  puedeAcceder: (modulo: string) => boolean;
  puedeEjecutar: (accion: string) => boolean;
}

export function useRol(): UseRolReturn {
  const [rol, setRol] = useState<Rol>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setLoading(false); return; }

      const { data } = await supabase
        .from("perfiles")
        .select("rol, tipo")
        .eq("id", auth.user.id)
        .single();

      if (data) {
        // Compatibilidad: si tiene tipo="admin" pero rol todavía no fue migrado
        const rolFinal =
          data.rol ??
          (data.tipo === "admin" ? "admin_general" : "corredor");
        setRol(rolFinal as Rol);
      }
      setLoading(false);
    };
    cargar();
  }, []);

  const puedeAcceder = (modulo: string): boolean => {
    if (!rol) return false;
    const permitidos = PERMISOS[modulo];
    if (!permitidos) return true; // módulo sin restricción explícita = acceso libre
    return permitidos.includes(rol);
  };

  const puedeEjecutar = (accion: string): boolean => {
    if (!rol) return false;
    const permitidos = ACCIONES[accion];
    if (!permitidos) return false; // acción no definida = denegado por defecto
    return permitidos.includes(rol);
  };

  return {
    rol,
    loading,
    isAdminGeneral:   rol === "admin_general",
    isAdminContenido: rol === "admin_contenido",
    isModerador:      rol === "moderador",
    isCorredor:       rol === "corredor",
    isColaborador:    rol === "colaborador",
    isAdmin:          rol === "admin_general" || rol === "admin_contenido",
    puedeAcceder,
    puedeEjecutar,
  };
}
