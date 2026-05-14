-- Migration 048: MOD 51 (Bolsa de Trabajo), MOD 74 (COCIR estado),
--               MOD 40 (Presentaciones Comerciales), MOD 80 (2FA), MOD 138 (FTS foro)
SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 51 — Bolsa de Trabajo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bolsa_trabajo_ofertas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  tipo          text NOT NULL CHECK (tipo IN ('oferta','busqueda')),
  titulo        text NOT NULL,
  descripcion   text NOT NULL,
  zona          text,
  tipo_contrato text CHECK (tipo_contrato IN ('full','part','freelance','eventual','a_convenir')),
  remuneracion  text,
  requisitos    text,
  contacto_email text,
  contacto_tel  text,
  activo        boolean NOT NULL DEFAULT true,
  destacado     boolean NOT NULL DEFAULT false,
  vistas        int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolsa_activo ON bolsa_trabajo_ofertas(activo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bolsa_perfil ON bolsa_trabajo_ofertas(perfil_id);

ALTER TABLE bolsa_trabajo_ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bolsa_select_all ON bolsa_trabajo_ofertas;
CREATE POLICY bolsa_select_all ON bolsa_trabajo_ofertas
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS bolsa_insert_own ON bolsa_trabajo_ofertas;
CREATE POLICY bolsa_insert_own ON bolsa_trabajo_ofertas
  FOR INSERT WITH CHECK (perfil_id = auth.uid());

DROP POLICY IF EXISTS bolsa_update_own ON bolsa_trabajo_ofertas;
CREATE POLICY bolsa_update_own ON bolsa_trabajo_ofertas
  FOR UPDATE USING (perfil_id = auth.uid() OR EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'
  ));

DROP POLICY IF EXISTS bolsa_delete_own ON bolsa_trabajo_ofertas;
CREATE POLICY bolsa_delete_own ON bolsa_trabajo_ofertas
  FOR DELETE USING (perfil_id = auth.uid() OR EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 74 — Estado de validación COCIR en perfiles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS cocir_estado text DEFAULT 'sin_validar'
    CHECK (cocir_estado IN ('activo','suspendido','no_encontrado','sin_validar')),
  ADD COLUMN IF NOT EXISTS cocir_ultimo_control timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 40 — Presentaciones Comerciales
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_presentaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  mensaje         text,
  propiedades_ids uuid[] NOT NULL DEFAULT '{}',
  token           uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  valid_until     date,
  vistas          int NOT NULL DEFAULT 0,
  activa          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentaciones_perfil ON crm_presentaciones(perfil_id);
CREATE INDEX IF NOT EXISTS idx_presentaciones_token ON crm_presentaciones(token);

ALTER TABLE crm_presentaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pres_select_own ON crm_presentaciones;
CREATE POLICY pres_select_own ON crm_presentaciones
  FOR SELECT USING (perfil_id = auth.uid() OR EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'
  ));

DROP POLICY IF EXISTS pres_insert_own ON crm_presentaciones;
CREATE POLICY pres_insert_own ON crm_presentaciones
  FOR INSERT WITH CHECK (perfil_id = auth.uid());

DROP POLICY IF EXISTS pres_update_own ON crm_presentaciones;
CREATE POLICY pres_update_own ON crm_presentaciones
  FOR UPDATE USING (perfil_id = auth.uid());

DROP POLICY IF EXISTS pres_delete_own ON crm_presentaciones;
CREATE POLICY pres_delete_own ON crm_presentaciones
  FOR DELETE USING (perfil_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 80 — 2FA obligatorio
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS mfa_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 138 — FTS índice para Memoria Colectiva del Foro
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE forum_topics
  ADD COLUMN IF NOT EXISTS fts_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('spanish', coalesce(body, '')), 'B')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_forum_topics_fts ON forum_topics USING gin(fts_vector);

ALTER TABLE forum_replies
  ADD COLUMN IF NOT EXISTS fts_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('spanish', coalesce(body, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_forum_replies_fts ON forum_replies USING gin(fts_vector);
