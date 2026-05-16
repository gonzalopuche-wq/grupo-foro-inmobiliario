-- Migration 061: Tablas faltantes — comisiones, tasaciones_historial,
--                directorio_profesionales, documentos_legales

-- ───────────────────────────────────────────────────────────────────────────
-- 1. COMISIONES (honorarios del corredor por operación)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comisiones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  descripcion         text NOT NULL,
  tipo_operacion      text NOT NULL DEFAULT 'venta'
                        CHECK (tipo_operacion IN ('venta','locacion','alquiler_temporal','comercial','desarrollo','otro')),
  monto_comision      numeric(14,2) NOT NULL DEFAULT 0,
  moneda_comision     text NOT NULL DEFAULT 'ARS' CHECK (moneda_comision IN ('ARS','USD','EUR')),
  monto_cobrado       numeric(14,2) NOT NULL DEFAULT 0,
  estado              text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','cobrada','parcial','perdida')),
  fecha_operacion     date,
  negocio_id          uuid REFERENCES crm_negocios(id) ON DELETE SET NULL,
  propiedad_id        uuid REFERENCES cartera_propiedades(id) ON DELETE SET NULL,
  cliente_nombre      text,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comisiones_own_select" ON comisiones FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "comisiones_own_insert" ON comisiones FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "comisiones_own_update" ON comisiones FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "comisiones_own_delete" ON comisiones FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "comisiones_admin_all"  ON comisiones FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_comisiones_perfil ON comisiones(perfil_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_estado ON comisiones(estado);
CREATE INDEX IF NOT EXISTS idx_comisiones_fecha  ON comisiones(fecha_operacion DESC);

CREATE OR REPLACE FUNCTION update_comisiones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_comisiones_updated_at ON comisiones;
CREATE TRIGGER trg_comisiones_updated_at
  BEFORE UPDATE ON comisiones FOR EACH ROW EXECUTE FUNCTION update_comisiones_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. TASACIONES_HISTORIAL
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasaciones_historial (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  datos_propiedad     jsonb NOT NULL DEFAULT '{}',
  resultado           jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasaciones_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tas_historial_own_select" ON tasaciones_historial FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "tas_historial_own_insert" ON tasaciones_historial FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "tas_historial_admin_all"  ON tasaciones_historial FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_tasaciones_usuario ON tasaciones_historial(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tasaciones_fecha   ON tasaciones_historial(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. DIRECTORIO_PROFESIONALES (escribanos, abogados, contadores)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS directorio_profesionales (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  apellido     text NOT NULL,
  profesion    text NOT NULL CHECK (profesion IN ('escribano','abogado','contador')),
  especialidad text,
  zona         text,
  telefono     text,
  email        text,
  direccion    text,
  matricula    text,
  descripcion  text,
  destacado    boolean NOT NULL DEFAULT false,
  verificado   boolean NOT NULL DEFAULT false,
  activo       boolean NOT NULL DEFAULT true,
  creado_por   uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE directorio_profesionales ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver
CREATE POLICY "dir_prof_select" ON directorio_profesionales FOR SELECT USING (auth.uid() IS NOT NULL AND activo = true);
-- Admin gestiona todo
CREATE POLICY "dir_prof_admin_all" ON directorio_profesionales FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_dir_prof_profesion ON directorio_profesionales(profesion);
CREATE INDEX IF NOT EXISTS idx_dir_prof_destacado  ON directorio_profesionales(destacado DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. DOCUMENTOS_LEGALES (biblioteca de normativa y guías)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_legales (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descripcion text,
  categoria   text NOT NULL DEFAULT 'General',
  tipo        text NOT NULL DEFAULT 'guia'
                CHECK (tipo IN ('guia','modelo','normativa','formulario')),
  archivo_url text,
  contenido   text,
  vigente     boolean NOT NULL DEFAULT true,
  destacado   boolean NOT NULL DEFAULT false,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documentos_legales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_legales_select" ON documentos_legales FOR SELECT USING (auth.uid() IS NOT NULL AND vigente = true);
CREATE POLICY "docs_legales_admin_all" ON documentos_legales FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_docs_legales_categoria ON documentos_legales(categoria);
CREATE INDEX IF NOT EXISTS idx_docs_legales_destacado  ON documentos_legales(destacado DESC, orden);
