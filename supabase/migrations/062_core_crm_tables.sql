-- Migration 062: Tablas core del CRM (crm_contactos, crm_negocios, crm_tareas,
--                crm_notas, crm_interacciones) — existentes en producción,
--                documentadas aquí para reproducibilidad.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. CRM_CONTACTOS
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_contactos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre              text NOT NULL DEFAULT '',
  apellido            text NOT NULL DEFAULT '',
  telefono            text,
  email               text,
  matricula           text,
  inmobiliaria        text,
  corredor_ref_id     uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  etiquetas           text[],
  notas               text,
  tipo                text DEFAULT 'cliente',
  estado              text DEFAULT 'lead:nuevo',
  origen              text,
  interes             text,
  presupuesto_min     numeric(14,2),
  presupuesto_max     numeric(14,2),
  moneda              text DEFAULT 'USD',
  zona_interes        text,
  dni                 text,
  domicilio           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contactos_own_select" ON crm_contactos FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crm_contactos_own_insert" ON crm_contactos FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_contactos_own_update" ON crm_contactos FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_contactos_own_delete" ON crm_contactos FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_contactos_admin_all"  ON crm_contactos FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_contactos_perfil    ON crm_contactos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_updated   ON crm_contactos(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_estado    ON crm_contactos(estado);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CRM_NEGOCIOS
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_negocios (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contacto_id           uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,
  titulo                text NOT NULL,
  tipo_operacion        text NOT NULL DEFAULT 'venta',
  etapa                 text NOT NULL DEFAULT 'prospecto',
  descripcion           text,
  direccion             text,
  valor_operacion       numeric(14,2),
  moneda                text NOT NULL DEFAULT 'USD',
  honorarios_pct        numeric(5,2),
  fecha_primer_contacto date,
  fecha_visita          date,
  fecha_reserva         date,
  fecha_escritura       date,
  fecha_cierre          date,
  colega_id             uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  split_pct             numeric(5,2),
  etiquetas             text[],
  notas                 text,
  archivado             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_negocios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_negocios_own_select" ON crm_negocios FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crm_negocios_own_insert" ON crm_negocios FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_negocios_own_update" ON crm_negocios FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_negocios_own_delete" ON crm_negocios FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_negocios_admin_all"  ON crm_negocios FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_negocios_perfil   ON crm_negocios(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_negocios_etapa    ON crm_negocios(etapa);
CREATE INDEX IF NOT EXISTS idx_crm_negocios_updated  ON crm_negocios(updated_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. CRM_TAREAS
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tareas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contacto_id       uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,
  negocio_id        uuid REFERENCES crm_negocios(id) ON DELETE SET NULL,
  titulo            text NOT NULL,
  descripcion       text,
  tipo              text NOT NULL DEFAULT 'tarea',
  prioridad         text NOT NULL DEFAULT 'media',
  estado            text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','en_progreso','completada','cancelada')),
  fecha_vencimiento date,
  fecha_completada  timestamptz,
  etiquetas         text[],
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_tareas_own_select" ON crm_tareas FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crm_tareas_own_insert" ON crm_tareas FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_tareas_own_update" ON crm_tareas FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_tareas_own_delete" ON crm_tareas FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_tareas_admin_all"  ON crm_tareas FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_tareas_perfil    ON crm_tareas(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_estado    ON crm_tareas(estado);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_vencimiento ON crm_tareas(fecha_vencimiento);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. CRM_NOTAS
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_notas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contacto_id uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,
  negocio_id  uuid REFERENCES crm_negocios(id) ON DELETE SET NULL,
  titulo      text,
  contenido   text NOT NULL DEFAULT '',
  tipo        text NOT NULL DEFAULT 'general',
  fijada      boolean NOT NULL DEFAULT false,
  etiquetas   text[],
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_notas_own_select" ON crm_notas FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crm_notas_own_insert" ON crm_notas FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_notas_own_update" ON crm_notas FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_notas_own_delete" ON crm_notas FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_notas_admin_all"  ON crm_notas FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_notas_perfil     ON crm_notas(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_notas_fijada     ON crm_notas(fijada DESC);
CREATE INDEX IF NOT EXISTS idx_crm_notas_contacto   ON crm_notas(contacto_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. CRM_INTERACCIONES
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_interacciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contacto_id uuid REFERENCES crm_contactos(id) ON DELETE CASCADE,
  negocio_id  uuid REFERENCES crm_negocios(id) ON DELETE SET NULL,
  tipo        text NOT NULL DEFAULT 'nota'
                CHECK (tipo IN ('nota','llamada','whatsapp','email','reunion','visita','otro')),
  descripcion text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_interacciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_interacciones_own_select" ON crm_interacciones FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crm_interacciones_own_insert" ON crm_interacciones FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_interacciones_own_delete" ON crm_interacciones FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_interacciones_admin_all"  ON crm_interacciones FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_inter_perfil   ON crm_interacciones(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_inter_contacto ON crm_interacciones(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_inter_created  ON crm_interacciones(created_at DESC);
