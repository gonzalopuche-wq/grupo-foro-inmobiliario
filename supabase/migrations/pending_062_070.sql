-- ============================================================
-- MIGRACIONES PENDIENTES 062 → 070
-- Idempotente: seguro correr aunque algunas ya estén aplicadas.
-- ============================================================

-- Función helper de admin (idempotente con CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION es_admin_gfi() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS
$$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin', 'master')
  );
$$;


-- ────────────────────────────────────────────────────────────
-- 062: Tablas core CRM
-- ────────────────────────────────────────────────────────────

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

-- Columnas que pueden faltar si la tabla existía antes con schema reducido
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS estado        text DEFAULT 'lead:nuevo';
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS tipo          text DEFAULT 'cliente';
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS origen        text;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS interes       text;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS presupuesto_min numeric(14,2);
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS presupuesto_max numeric(14,2);
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS moneda        text DEFAULT 'USD';
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS zona_interes  text;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS dni           text;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS domicilio     text;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS matricula     text;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS inmobiliaria  text;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS corredor_ref_id uuid REFERENCES perfiles(id) ON DELETE SET NULL;
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS etiquetas     text[];
ALTER TABLE crm_contactos ADD COLUMN IF NOT EXISTS notas         text;

DROP POLICY IF EXISTS "crm_contactos_own_select" ON crm_contactos;
CREATE POLICY "crm_contactos_own_select" ON crm_contactos FOR SELECT USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_contactos_own_insert" ON crm_contactos;
CREATE POLICY "crm_contactos_own_insert" ON crm_contactos FOR INSERT WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_contactos_own_update" ON crm_contactos;
CREATE POLICY "crm_contactos_own_update" ON crm_contactos FOR UPDATE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_contactos_own_delete" ON crm_contactos;
CREATE POLICY "crm_contactos_own_delete" ON crm_contactos FOR DELETE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_contactos_admin_all" ON crm_contactos;
CREATE POLICY "crm_contactos_admin_all"  ON crm_contactos FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_contactos_perfil    ON crm_contactos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_updated   ON crm_contactos(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_estado    ON crm_contactos(estado);

-- ──

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

ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS etapa              text NOT NULL DEFAULT 'prospecto';
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS tipo_operacion     text NOT NULL DEFAULT 'venta';
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS descripcion        text;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS direccion          text;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS valor_operacion    numeric(14,2);
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS moneda             text NOT NULL DEFAULT 'USD';
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS honorarios_pct     numeric(5,2);
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS fecha_primer_contacto date;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS fecha_visita       date;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS fecha_reserva      date;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS fecha_escritura    date;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS fecha_cierre       date;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS colega_id          uuid REFERENCES perfiles(id) ON DELETE SET NULL;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS split_pct          numeric(5,2);
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS etiquetas          text[];
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS notas              text;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS archivado          boolean NOT NULL DEFAULT false;
ALTER TABLE crm_negocios ADD COLUMN IF NOT EXISTS contacto_id        uuid REFERENCES crm_contactos(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "crm_negocios_own_select" ON crm_negocios;
CREATE POLICY "crm_negocios_own_select" ON crm_negocios FOR SELECT USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_negocios_own_insert" ON crm_negocios;
CREATE POLICY "crm_negocios_own_insert" ON crm_negocios FOR INSERT WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_negocios_own_update" ON crm_negocios;
CREATE POLICY "crm_negocios_own_update" ON crm_negocios FOR UPDATE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_negocios_own_delete" ON crm_negocios;
CREATE POLICY "crm_negocios_own_delete" ON crm_negocios FOR DELETE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_negocios_admin_all" ON crm_negocios;
CREATE POLICY "crm_negocios_admin_all"  ON crm_negocios FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_negocios_perfil   ON crm_negocios(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_negocios_etapa    ON crm_negocios(etapa);
CREATE INDEX IF NOT EXISTS idx_crm_negocios_updated  ON crm_negocios(updated_at DESC);

-- ──

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

ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS estado            text NOT NULL DEFAULT 'pendiente';
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS tipo              text NOT NULL DEFAULT 'tarea';
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS prioridad         text NOT NULL DEFAULT 'media';
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS descripcion       text;
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS fecha_completada  timestamptz;
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS etiquetas         text[];
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS notas             text;
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS contacto_id       uuid REFERENCES crm_contactos(id) ON DELETE SET NULL;
ALTER TABLE crm_tareas ADD COLUMN IF NOT EXISTS negocio_id        uuid REFERENCES crm_negocios(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "crm_tareas_own_select" ON crm_tareas;
CREATE POLICY "crm_tareas_own_select" ON crm_tareas FOR SELECT USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_tareas_own_insert" ON crm_tareas;
CREATE POLICY "crm_tareas_own_insert" ON crm_tareas FOR INSERT WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_tareas_own_update" ON crm_tareas;
CREATE POLICY "crm_tareas_own_update" ON crm_tareas FOR UPDATE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_tareas_own_delete" ON crm_tareas;
CREATE POLICY "crm_tareas_own_delete" ON crm_tareas FOR DELETE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_tareas_admin_all" ON crm_tareas;
CREATE POLICY "crm_tareas_admin_all"  ON crm_tareas FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_tareas_perfil      ON crm_tareas(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_estado      ON crm_tareas(estado);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_vencimiento ON crm_tareas(fecha_vencimiento);

-- ──

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

ALTER TABLE crm_notas ADD COLUMN IF NOT EXISTS titulo      text;
ALTER TABLE crm_notas ADD COLUMN IF NOT EXISTS tipo        text NOT NULL DEFAULT 'general';
ALTER TABLE crm_notas ADD COLUMN IF NOT EXISTS fijada      boolean NOT NULL DEFAULT false;
ALTER TABLE crm_notas ADD COLUMN IF NOT EXISTS etiquetas   text[];
ALTER TABLE crm_notas ADD COLUMN IF NOT EXISTS contacto_id uuid REFERENCES crm_contactos(id) ON DELETE SET NULL;
ALTER TABLE crm_notas ADD COLUMN IF NOT EXISTS negocio_id  uuid REFERENCES crm_negocios(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "crm_notas_own_select" ON crm_notas;
CREATE POLICY "crm_notas_own_select" ON crm_notas FOR SELECT USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_notas_own_insert" ON crm_notas;
CREATE POLICY "crm_notas_own_insert" ON crm_notas FOR INSERT WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_notas_own_update" ON crm_notas;
CREATE POLICY "crm_notas_own_update" ON crm_notas FOR UPDATE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_notas_own_delete" ON crm_notas;
CREATE POLICY "crm_notas_own_delete" ON crm_notas FOR DELETE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_notas_admin_all" ON crm_notas;
CREATE POLICY "crm_notas_admin_all"  ON crm_notas FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_notas_perfil   ON crm_notas(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_notas_fijada   ON crm_notas(fijada DESC);
CREATE INDEX IF NOT EXISTS idx_crm_notas_contacto ON crm_notas(contacto_id);

-- ──

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

ALTER TABLE crm_interacciones ADD COLUMN IF NOT EXISTS tipo        text NOT NULL DEFAULT 'nota';
ALTER TABLE crm_interacciones ADD COLUMN IF NOT EXISTS descripcion text NOT NULL DEFAULT '';
ALTER TABLE crm_interacciones ADD COLUMN IF NOT EXISTS contacto_id uuid REFERENCES crm_contactos(id) ON DELETE CASCADE;
ALTER TABLE crm_interacciones ADD COLUMN IF NOT EXISTS negocio_id  uuid REFERENCES crm_negocios(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "crm_interacciones_own_select" ON crm_interacciones;
CREATE POLICY "crm_interacciones_own_select" ON crm_interacciones FOR SELECT USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_interacciones_own_insert" ON crm_interacciones;
CREATE POLICY "crm_interacciones_own_insert" ON crm_interacciones FOR INSERT WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_interacciones_own_delete" ON crm_interacciones;
CREATE POLICY "crm_interacciones_own_delete" ON crm_interacciones FOR DELETE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_interacciones_admin_all" ON crm_interacciones;
CREATE POLICY "crm_interacciones_admin_all"  ON crm_interacciones FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_inter_perfil   ON crm_interacciones(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_inter_contacto ON crm_interacciones(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_inter_created  ON crm_interacciones(created_at DESC);


-- ────────────────────────────────────────────────────────────
-- 063: crm_recordatorios
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_recordatorios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contacto_id         uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,
  negocio_id          uuid REFERENCES crm_negocios(id) ON DELETE SET NULL,
  titulo              text,
  descripcion         text NOT NULL DEFAULT '',
  notas               text,
  fecha_recordatorio  timestamptz NOT NULL,
  estado              text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','completado','cancelado')),
  completado          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_recordatorios ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS estado             text NOT NULL DEFAULT 'pendiente';
ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS completado         boolean NOT NULL DEFAULT false;
ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS titulo             text;
ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS descripcion        text NOT NULL DEFAULT '';
ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS notas              text;
ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS fecha_recordatorio timestamptz;
ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS contacto_id        uuid REFERENCES crm_contactos(id) ON DELETE SET NULL;
ALTER TABLE crm_recordatorios ADD COLUMN IF NOT EXISTS negocio_id         uuid REFERENCES crm_negocios(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "crm_rec_own_select" ON crm_recordatorios;
CREATE POLICY "crm_rec_own_select" ON crm_recordatorios FOR SELECT USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_rec_own_insert" ON crm_recordatorios;
CREATE POLICY "crm_rec_own_insert" ON crm_recordatorios FOR INSERT WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_rec_own_update" ON crm_recordatorios;
CREATE POLICY "crm_rec_own_update" ON crm_recordatorios FOR UPDATE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_rec_own_delete" ON crm_recordatorios;
CREATE POLICY "crm_rec_own_delete" ON crm_recordatorios FOR DELETE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_rec_admin_all" ON crm_recordatorios;
CREATE POLICY "crm_rec_admin_all"  ON crm_recordatorios FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_rec_perfil   ON crm_recordatorios(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_rec_fecha    ON crm_recordatorios(fecha_recordatorio);
CREATE INDEX IF NOT EXISTS idx_crm_rec_estado   ON crm_recordatorios(estado);
CREATE INDEX IF NOT EXISTS idx_crm_rec_contacto ON crm_recordatorios(contacto_id);


-- ────────────────────────────────────────────────────────────
-- 064: eventos_agenda
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eventos_agenda (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  fecha       date NOT NULL,
  hora        text,
  hora_fin    text,
  tipo        text NOT NULL DEFAULT 'cita'
                CHECK (tipo IN ('cita','llamada','visita','reunion','recordatorio','otro')),
  descripcion text,
  lugar       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eventos_agenda ENABLE ROW LEVEL SECURITY;

ALTER TABLE eventos_agenda ADD COLUMN IF NOT EXISTS tipo        text NOT NULL DEFAULT 'cita';
ALTER TABLE eventos_agenda ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE eventos_agenda ADD COLUMN IF NOT EXISTS lugar       text;
ALTER TABLE eventos_agenda ADD COLUMN IF NOT EXISTS hora        text;
ALTER TABLE eventos_agenda ADD COLUMN IF NOT EXISTS hora_fin    text;

DROP POLICY IF EXISTS "eventos_agenda_own_select" ON eventos_agenda;
CREATE POLICY "eventos_agenda_own_select" ON eventos_agenda FOR SELECT USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "eventos_agenda_own_insert" ON eventos_agenda;
CREATE POLICY "eventos_agenda_own_insert" ON eventos_agenda FOR INSERT WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "eventos_agenda_own_update" ON eventos_agenda;
CREATE POLICY "eventos_agenda_own_update" ON eventos_agenda FOR UPDATE USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "eventos_agenda_own_delete" ON eventos_agenda;
CREATE POLICY "eventos_agenda_own_delete" ON eventos_agenda FOR DELETE USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "eventos_agenda_admin_all" ON eventos_agenda;
CREATE POLICY "eventos_agenda_admin_all"  ON eventos_agenda FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_eventos_agenda_usuario ON eventos_agenda(usuario_id);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_fecha   ON eventos_agenda(fecha);


-- ────────────────────────────────────────────────────────────
-- 065: trigger sync_recordatorio_completado (idempotente)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_recordatorio_completado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.completado = (NEW.estado = 'completado');
  ELSIF NEW.completado IS DISTINCT FROM OLD.completado THEN
    NEW.estado = CASE WHEN NEW.completado THEN 'completado' ELSE 'pendiente' END;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_rec_completado ON crm_recordatorios;
CREATE TRIGGER trg_crm_rec_completado
  BEFORE INSERT OR UPDATE ON crm_recordatorios
  FOR EACH ROW EXECUTE FUNCTION sync_recordatorio_completado();


-- ────────────────────────────────────────────────────────────
-- 066: tablas CRM faltantes
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_plantillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  contenido   text NOT NULL,
  tipo        text NOT NULL DEFAULT 'whatsapp'
                CHECK (tipo IN ('whatsapp','email','sms','otro')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_plantillas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_plantillas_own" ON crm_plantillas;
CREATE POLICY "crm_plantillas_own"   ON crm_plantillas FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_plantillas_admin" ON crm_plantillas;
CREATE POLICY "crm_plantillas_admin" ON crm_plantillas FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_plantillas_perfil ON crm_plantillas(perfil_id);

-- ──

CREATE TABLE IF NOT EXISTS crm_propiedades_guardadas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id                uuid NOT NULL REFERENCES crm_listas_busqueda(id) ON DELETE CASCADE,
  corredor_id             uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  url_original            text NOT NULL,
  portal                  text,
  titulo                  text,
  precio_actual           numeric,
  precio_anterior         numeric,
  moneda                  text DEFAULT 'USD',
  disponible              boolean NOT NULL DEFAULT true,
  fecha_baja              timestamptz,
  precio_actualizado_at   timestamptz,
  descripcion             text,
  imagen_url              text,
  datos_extra             jsonb,
  orden                   integer DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_propiedades_guardadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_pg_own" ON crm_propiedades_guardadas;
CREATE POLICY "crm_pg_own"   ON crm_propiedades_guardadas FOR ALL USING (auth.uid() = corredor_id) WITH CHECK (auth.uid() = corredor_id);
DROP POLICY IF EXISTS "crm_pg_admin" ON crm_propiedades_guardadas;
CREATE POLICY "crm_pg_admin" ON crm_propiedades_guardadas FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_pg_lista    ON crm_propiedades_guardadas(lista_id);
CREATE INDEX IF NOT EXISTS idx_crm_pg_corredor ON crm_propiedades_guardadas(corredor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_pg_url ON crm_propiedades_guardadas(lista_id, url_original);

-- ──

CREATE TABLE IF NOT EXISTS crm_busqueda_alertas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id    uuid REFERENCES crm_propiedades_guardadas(id) ON DELETE CASCADE,
  lista_id        uuid REFERENCES crm_listas_busqueda(id) ON DELETE CASCADE,
  corredor_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo            text NOT NULL
                    CHECK (tipo IN ('nuevo','precio_baja','precio_suba','dado_de_baja')),
  valor_anterior  text,
  valor_nuevo     text,
  leida           boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_busqueda_alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_ba_own" ON crm_busqueda_alertas;
CREATE POLICY "crm_ba_own"   ON crm_busqueda_alertas FOR ALL USING (auth.uid() = corredor_id) WITH CHECK (auth.uid() = corredor_id);
DROP POLICY IF EXISTS "crm_ba_admin" ON crm_busqueda_alertas;
CREATE POLICY "crm_ba_admin" ON crm_busqueda_alertas FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_ba_corredor ON crm_busqueda_alertas(corredor_id);
CREATE INDEX IF NOT EXISTS idx_crm_ba_lista    ON crm_busqueda_alertas(lista_id);

-- ──

CREATE TABLE IF NOT EXISTS crm_integraciones_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo                  text NOT NULL,
  config                jsonb,
  activo                boolean NOT NULL DEFAULT true,
  ultima_sincronizacion timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, tipo)
);

ALTER TABLE crm_integraciones_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_ic_own" ON crm_integraciones_config;
CREATE POLICY "crm_ic_own"   ON crm_integraciones_config FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_ic_admin" ON crm_integraciones_config;
CREATE POLICY "crm_ic_admin" ON crm_integraciones_config FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_ic_perfil ON crm_integraciones_config(perfil_id);

-- ──

CREATE TABLE IF NOT EXISTS crm_integraciones_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo              text NOT NULL,
  estado            text NOT NULL DEFAULT 'completado'
                      CHECK (estado IN ('completado','error','parcial')),
  filas_importadas  integer DEFAULT 0,
  filas_error       integer DEFAULT 0,
  detalle           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_integraciones_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm_integraciones_log ADD COLUMN IF NOT EXISTS estado           text NOT NULL DEFAULT 'completado';
ALTER TABLE crm_integraciones_log ADD COLUMN IF NOT EXISTS filas_importadas integer DEFAULT 0;
ALTER TABLE crm_integraciones_log ADD COLUMN IF NOT EXISTS filas_error      integer DEFAULT 0;
ALTER TABLE crm_integraciones_log ADD COLUMN IF NOT EXISTS detalle          jsonb;

DROP POLICY IF EXISTS "crm_il_own" ON crm_integraciones_log;
CREATE POLICY "crm_il_own"   ON crm_integraciones_log FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_il_admin" ON crm_integraciones_log;
CREATE POLICY "crm_il_admin" ON crm_integraciones_log FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_il_perfil ON crm_integraciones_log(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_il_fecha  ON crm_integraciones_log(created_at DESC);

-- ──

CREATE TABLE IF NOT EXISTS crm_posts_sociales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  plataforma        text NOT NULL DEFAULT 'instagram'
                      CHECK (plataforma IN ('instagram','facebook','linkedin','twitter','otro')),
  contenido         text NOT NULL,
  imagen_url        text,
  fecha_programada  timestamptz,
  estado            text NOT NULL DEFAULT 'programado'
                      CHECK (estado IN ('programado','publicado','fallido','cancelado')),
  error_detalle     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_posts_sociales ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS plataforma       text NOT NULL DEFAULT 'instagram';
ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS imagen_url       text;
ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS fecha_programada timestamptz;
ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS estado           text NOT NULL DEFAULT 'programado';
ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS error_detalle    text;

DROP POLICY IF EXISTS "crm_ps_own" ON crm_posts_sociales;
CREATE POLICY "crm_ps_own"   ON crm_posts_sociales FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "crm_ps_admin" ON crm_posts_sociales;
CREATE POLICY "crm_ps_admin" ON crm_posts_sociales FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_ps_perfil ON crm_posts_sociales(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_ps_fecha  ON crm_posts_sociales(fecha_programada);


-- ────────────────────────────────────────────────────────────
-- 067: comparables
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comparables (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio                integer NOT NULL,
  mes                 integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  calle               text NOT NULL,
  altura              text,
  barrio              text,
  ciudad              text NOT NULL DEFAULT 'Rosario',
  tipo_inmueble       text NOT NULL,
  dormitorios         integer,
  banos               integer,
  antiguedad          integer,
  sup_cubierta        numeric(10,2),
  sup_terreno         numeric(10,2),
  disposicion         text,
  balcon              boolean NOT NULL DEFAULT false,
  patio               boolean NOT NULL DEFAULT false,
  amenities           text,
  precio_publicacion  numeric(14,2),
  precio_venta        numeric(14,2),
  propuesta_pago      text,
  cotizacion_dolar    numeric(10,2),
  notas               text,
  creado_at           timestamptz NOT NULL DEFAULT now(),
  actualizado_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comparables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comparables_own_select" ON comparables;
CREATE POLICY "comparables_own_select" ON comparables FOR SELECT USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "comparables_own_insert" ON comparables;
CREATE POLICY "comparables_own_insert" ON comparables FOR INSERT WITH CHECK (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "comparables_own_update" ON comparables;
CREATE POLICY "comparables_own_update" ON comparables FOR UPDATE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "comparables_own_delete" ON comparables;
CREATE POLICY "comparables_own_delete" ON comparables FOR DELETE USING (auth.uid() = perfil_id);
DROP POLICY IF EXISTS "comparables_admin_all" ON comparables;
CREATE POLICY "comparables_admin_all"  ON comparables FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_comparables_perfil ON comparables(perfil_id);
CREATE INDEX IF NOT EXISTS idx_comparables_barrio  ON comparables(barrio);
CREATE INDEX IF NOT EXISTS idx_comparables_anio    ON comparables(anio DESC, mes DESC);


-- ────────────────────────────────────────────────────────────
-- 068: columnas faltantes en crm_propiedades_guardadas y crm_busqueda_alertas
-- ────────────────────────────────────────────────────────────

ALTER TABLE crm_propiedades_guardadas
  ADD COLUMN IF NOT EXISTS portal               text,
  ADD COLUMN IF NOT EXISTS disponible           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fecha_baja           timestamptz,
  ADD COLUMN IF NOT EXISTS precio_anterior      numeric,
  ADD COLUMN IF NOT EXISTS precio_actualizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS descripcion          text,
  ADD COLUMN IF NOT EXISTS portal_id            text;

UPDATE crm_propiedades_guardadas SET disponible = true WHERE disponible IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_pg_disponible ON crm_propiedades_guardadas(disponible) WHERE disponible = true;

ALTER TABLE crm_busqueda_alertas
  ADD COLUMN IF NOT EXISTS leida boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_crm_ba_no_leida ON crm_busqueda_alertas(corredor_id) WHERE leida = false;


-- ────────────────────────────────────────────────────────────
-- 069: web_corredor_config (documentar tabla + columnas sociales)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS web_corredor_config (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id                     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  slug                          text UNIQUE NOT NULL,
  dominio_propio                text,
  plantilla                     text NOT NULL DEFAULT 'rosario-classic',
  activa                        boolean NOT NULL DEFAULT false,
  logo_url                      text,
  cover_url                     text,
  foto_sobre_mi_url             text,
  color_primario                text NOT NULL DEFAULT '#cc0000',
  color_secundario              text NOT NULL DEFAULT '#111111',
  color_texto                   text NOT NULL DEFAULT '#222222',
  color_fondo                   text NOT NULL DEFAULT '#ffffff',
  titulo_sitio                  text,
  subtitulo                     text,
  descripcion_profesional       text,
  anos_experiencia              integer,
  mostrar_formulario_contacto   boolean NOT NULL DEFAULT true,
  mostrar_formulario_tasacion   boolean NOT NULL DEFAULT true,
  mostrar_propiedades_destacadas boolean NOT NULL DEFAULT true,
  mostrar_sobre_mi              boolean NOT NULL DEFAULT true,
  mostrar_testimonios           boolean NOT NULL DEFAULT false,
  mostrar_blog                  boolean NOT NULL DEFAULT false,
  seo_titulo                    text,
  seo_descripcion               text,
  seo_keywords                  text,
  instagram                     text,
  facebook                      text,
  twitter                       text,
  linkedin                      text,
  whatsapp                      text,
  limite_propiedades_home       integer NOT NULL DEFAULT 6,
  google_analytics              text,
  script_header                 text,
  script_footer                 text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE web_corredor_config
  ADD COLUMN IF NOT EXISTS instagram         text,
  ADD COLUMN IF NOT EXISTS facebook          text,
  ADD COLUMN IF NOT EXISTS twitter           text,
  ADD COLUMN IF NOT EXISTS linkedin          text,
  ADD COLUMN IF NOT EXISTS whatsapp          text,
  ADD COLUMN IF NOT EXISTS mostrar_blog      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS script_header     text,
  ADD COLUMN IF NOT EXISTS script_footer     text,
  ADD COLUMN IF NOT EXISTS foto_sobre_mi_url text,
  ADD COLUMN IF NOT EXISTS seo_keywords      text,
  ADD COLUMN IF NOT EXISTS google_analytics  text,
  ADD COLUMN IF NOT EXISTS cover_url         text;

ALTER TABLE web_corredor_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'web_corredor_config' AND policyname = 'wcc_own') THEN
    CREATE POLICY "wcc_own" ON web_corredor_config
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'web_corredor_config' AND policyname = 'wcc_public_read') THEN
    CREATE POLICY "wcc_public_read" ON web_corredor_config
      FOR SELECT USING (activa = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'web_corredor_config' AND policyname = 'wcc_admin') THEN
    CREATE POLICY "wcc_admin" ON web_corredor_config
      FOR ALL USING (es_admin_gfi());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wcc_perfil ON web_corredor_config(perfil_id);
CREATE INDEX IF NOT EXISTS idx_wcc_slug   ON web_corredor_config(slug);


-- ────────────────────────────────────────────────────────────
-- 070: columna tiktok en web_corredor_config
-- ────────────────────────────────────────────────────────────

ALTER TABLE web_corredor_config
  ADD COLUMN IF NOT EXISTS tiktok text;
