-- ─────────────────────────────────────────────────────────────────────────────
-- 013 · MEDIUM PRIORITY FEATURES
-- · Gestión de Honorarios (crm_honorarios)
-- · Seguimiento Post-cierre (crm_post_cierre)
-- · Metas y Objetivos (crm_metas)
-- · Modo Silencioso en perfiles
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Modo Silencioso ───────────────────────────────────────────────────────
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS modo_silencioso    BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS silencioso_hasta   TIMESTAMPTZ;

-- ── 2. Gestión de Honorarios ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_honorarios (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id        UUID REFERENCES crm_negocios(id) ON DELETE SET NULL,
  titulo            TEXT NOT NULL,
  tipo_operacion    TEXT NOT NULL DEFAULT 'venta',
  valor_operacion   NUMERIC(14,2),
  moneda            TEXT NOT NULL DEFAULT 'USD',
  honorarios_pct    NUMERIC(5,2),
  honorarios_monto  NUMERIC(14,2),
  split_colega_id   UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  split_pct         NUMERIC(5,2),
  split_monto       NUMERIC(14,2),
  estado            TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | cobrado | parcial
  fecha_cobro       DATE,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_honorarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_honorarios_owner" ON crm_honorarios;
CREATE POLICY "crm_honorarios_owner" ON crm_honorarios
  FOR ALL USING (perfil_id = auth.uid());

-- ── 3. Seguimiento Post-cierre ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_post_cierre (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id    UUID REFERENCES crm_negocios(id) ON DELETE SET NULL,
  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'tarea',  -- tarea | contacto | documento | fecha
  descripcion   TEXT,
  fecha_limite  DATE,
  completado    BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_hecho   DATE,
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_post_cierre ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_post_cierre_owner" ON crm_post_cierre;
CREATE POLICY "crm_post_cierre_owner" ON crm_post_cierre
  FOR ALL USING (perfil_id = auth.uid());

-- ── 4. Metas y Objetivos ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_metas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  tipo          TEXT NOT NULL DEFAULT 'operaciones',
  periodo       TEXT NOT NULL DEFAULT 'mensual',
  objetivo      NUMERIC(14,2) NOT NULL,
  progreso      NUMERIC(14,2) NOT NULL DEFAULT 0,
  moneda        TEXT DEFAULT 'USD',
  fecha_inicio  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin     DATE,
  activa        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_metas_owner" ON crm_metas;
CREATE POLICY "crm_metas_owner" ON crm_metas
  FOR ALL USING (perfil_id = auth.uid());
