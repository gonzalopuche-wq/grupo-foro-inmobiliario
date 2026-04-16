// ─────────────────────────────────────────────
// CAMBIOS A APLICAR EN app/(private)/cotizaciones/page.tsx
// ─────────────────────────────────────────────

// 1. AGREGAR este import al principio del archivo (después de los imports existentes):
import ActualizarCotizacionModal from "./ActualizarCotizacionModal";

// 2. AGREGAR estos estados dentro del componente CotizacionesPage,
//    junto a los useState existentes:
const [esAdmin, setEsAdmin] = useState(false);
const [proveedorActualizando, setProveedorActualizando] = useState<Proveedor | null>(null);

// 3. EN el useEffect de init (donde ya se hace getUser), AGREGAR la consulta de perfil:
//    Reemplazar el bloque init existente:
const init = async () => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) { window.location.href = "/"; return; }
  setUserId(data.user.id);

  // NUEVO: traer tipo de perfil para saber si es admin
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("tipo")
    .eq("id", data.user.id)
    .single();
  if (perfil?.tipo === "admin") setEsAdmin(true);
};

// 4. EN la sección de PROVEEDORES (vista === "proveedores"),
//    dentro de .prov-acciones de cada proveedor, AGREGAR el botón después del link de WhatsApp:
{esAdmin && (
  <button
    onClick={() => setProveedorActualizando(p)}
    style={{
      padding: "8px 18px",
      background: "rgba(200,0,0,0.1)",
      border: "1px solid rgba(200,0,0,0.3)",
      borderRadius: 3,
      color: "#cc0000",
      fontFamily: "'Montserrat', sans-serif",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: "pointer",
    }}
  >
    ✏️ Actualizar cotización
  </button>
)}

// 5. AGREGAR el modal al final del return, antes del cierre </> o del modal de publicar:
{proveedorActualizando && userId && (
  <ActualizarCotizacionModal
    proveedor={proveedorActualizando}
    userId={userId}
    esAdmin={esAdmin}
    onClose={() => setProveedorActualizando(null)}
    onGuardado={() => {
      cargarProveedores();
      setProveedorActualizando(null);
    }}
  />
)}
