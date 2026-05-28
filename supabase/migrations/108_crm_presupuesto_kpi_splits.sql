-- Migration 108: tablas para presupuesto anual, metas personales, KPI diario,
--                comisiones split, seguimiento de ofertas y honorarios cuotas

-- ── Presupuesto anual (JSONB blob por año) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_presupuesto_anual (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio       int  NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, anio)
);
ALTER TABLE crm_presupuesto_anual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_presupuesto_anual_own" ON crm_presupuesto_anual
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Metas personales ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_metas_personales (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id            uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio                 int  NOT NULL,
  meta_honorarios_usd  numeric NOT NULL DEFAULT 50000,
  meta_operaciones     int     NOT NULL DEFAULT 24,
  meta_nuevas_capt     int     NOT NULL DEFAULT 48,
  meta_tasaciones      int     NOT NULL DEFAULT 20,
  meta_tasa_cierre_obj numeric NOT NULL DEFAULT 30,
  tipo_cambio          int     NOT NULL DEFAULT 1300,
  notas                text,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, anio)
);
ALTER TABLE crm_metas_personales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_metas_personales_own" ON crm_metas_personales
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── KPI diario (una fila por usuario + día) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_kpi_diario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  fecha            date NOT NULL,
  llamadas         int     NOT NULL DEFAULT 0,
  whatsapps        int     NOT NULL DEFAULT 0,
  emails           int     NOT NULL DEFAULT 0,
  visitas          int     NOT NULL DEFAULT 0,
  tasaciones       int     NOT NULL DEFAULT 0,
  nuevos_contactos int     NOT NULL DEFAULT 0,
  publicaciones    int     NOT NULL DEFAULT 0,
  reuniones        int     NOT NULL DEFAULT 0,
  captaciones      int     NOT NULL DEFAULT 0,
  cierres          numeric NOT NULL DEFAULT 0,
  notas            text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, fecha)
);
ALTER TABLE crm_kpi_diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_kpi_diario_own" ON crm_kpi_diario
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE INDEX IF NOT EXISTS idx_crm_kpi_diario_perfil_fecha
  ON crm_kpi_diario(perfil_id, fecha DESC);

-- ── KPI meta diaria (configuración por usuario) ───────────────────────────────

CREATE TABLE IF NOT EXISTS crm_kpi_meta (
  perfil_id        uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  llamadas         numeric NOT NULL DEFAULT 20,
  whatsapps        numeric NOT NULL DEFAULT 15,
  emails           numeric NOT NULL DEFAULT 10,
  visitas          numeric NOT NULL DEFAULT 3,
  tasaciones       numeric NOT NULL DEFAULT 2,
  nuevos_contactos numeric NOT NULL DEFAULT 5,
  publicaciones    numeric NOT NULL DEFAULT 3,
  reuniones        numeric NOT NULL DEFAULT 2,
  captaciones      numeric NOT NULL DEFAULT 1,
  cierres          numeric NOT NULL DEFAULT 0.2,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_kpi_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_kpi_meta_own" ON crm_kpi_meta
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Comisiones split (JSONB array por usuario) ────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_comisiones_split (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  operaciones jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_comisiones_split ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_comisiones_split_own" ON crm_comisiones_split
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Seguimiento de ofertas (JSONB array por usuario) ─────────────────────────

CREATE TABLE IF NOT EXISTS crm_seguimiento_ofertas (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  ofertas    jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_seguimiento_ofertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_seguimiento_ofertas_own" ON crm_seguimiento_ofertas
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Honorarios cuotas (por negocio por usuario) ───────────────────────────────

CREATE TABLE IF NOT EXISTS crm_honorarios_cuotas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id  uuid NOT NULL,
  cuotas      jsonb NOT NULL DEFAULT '[]',
  notas       text,
  estado      text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','parcial','cobrado','vencido','incobrable')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, negocio_id)
);
ALTER TABLE crm_honorarios_cuotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_honorarios_cuotas_own" ON crm_honorarios_cuotas
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE INDEX IF NOT EXISTS idx_crm_honorarios_cuotas_perfil
  ON crm_honorarios_cuotas(perfil_id);
