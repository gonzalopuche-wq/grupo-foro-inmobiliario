-- Migration 066: tablas CRM faltantes — crm_plantillas, crm_propiedades_guardadas,
-- crm_busqueda_alertas, crm_integraciones_config, crm_integraciones_log,
-- crm_posts_sociales.

-- ── crm_plantillas ────────────────────────────────────────────────────────
-- Plantillas de mensajes reutilizables (WhatsApp, email, etc.)
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
CREATE POLICY "crm_plantillas_own" ON crm_plantillas FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_plantillas_admin" ON crm_plantillas FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_plantillas_perfil ON crm_plantillas(perfil_id);

-- ── crm_propiedades_guardadas ─────────────────────────────────────────────
-- Propiedades guardadas en listas de búsqueda activa (scraper)
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
CREATE POLICY "crm_pg_own"   ON crm_propiedades_guardadas FOR ALL USING (auth.uid() = corredor_id) WITH CHECK (auth.uid() = corredor_id);
CREATE POLICY "crm_pg_admin" ON crm_propiedades_guardadas FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_pg_lista    ON crm_propiedades_guardadas(lista_id);
CREATE INDEX IF NOT EXISTS idx_crm_pg_corredor ON crm_propiedades_guardadas(corredor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_pg_url ON crm_propiedades_guardadas(lista_id, url_original);

-- ── crm_busqueda_alertas ──────────────────────────────────────────────────
-- Alertas generadas cuando una propiedad guardada cambia (precio, baja, etc.)
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
CREATE POLICY "crm_ba_own"   ON crm_busqueda_alertas FOR ALL USING (auth.uid() = corredor_id) WITH CHECK (auth.uid() = corredor_id);
CREATE POLICY "crm_ba_admin" ON crm_busqueda_alertas FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_ba_corredor ON crm_busqueda_alertas(corredor_id);
CREATE INDEX IF NOT EXISTS idx_crm_ba_lista    ON crm_busqueda_alertas(lista_id);

-- ── crm_integraciones_config ──────────────────────────────────────────────
-- Configuración de integraciones por corredor (tokko, kiteprop, etc.)
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
CREATE POLICY "crm_ic_own"   ON crm_integraciones_config FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_ic_admin" ON crm_integraciones_config FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_ic_perfil ON crm_integraciones_config(perfil_id);

-- ── crm_integraciones_log ─────────────────────────────────────────────────
-- Log de sincronizaciones de integraciones
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
CREATE POLICY "crm_il_own"   ON crm_integraciones_log FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_il_admin" ON crm_integraciones_log FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_il_perfil ON crm_integraciones_log(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_il_fecha  ON crm_integraciones_log(created_at DESC);

-- ── crm_posts_sociales ────────────────────────────────────────────────────
-- Posts de redes sociales programados o publicados
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
CREATE POLICY "crm_ps_own"   ON crm_posts_sociales FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_ps_admin" ON crm_posts_sociales FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_crm_ps_perfil ON crm_posts_sociales(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_ps_fecha  ON crm_posts_sociales(fecha_programada);
