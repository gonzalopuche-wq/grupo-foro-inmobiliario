-- Migration 109: objetivos, scorecard semanal, cobros de comisiones,
--                campana cumpleaños, plantillas mensajes, campanas marketing,
--                red de contactos, referidos, seguimiento post-venta,
--                checklist cierre, propuestas comerciales, campana reactivación

-- ── Objetivos CRM ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_objetivos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  descripcion text,
  categoria   text NOT NULL DEFAULT 'general',
  meta        numeric NOT NULL DEFAULT 0,
  unidad      text NOT NULL DEFAULT 'ops',
  periodo     text NOT NULL DEFAULT 'anual' CHECK (periodo IN ('mensual','trimestral','anual')),
  anio        int  NOT NULL,
  mes         int,
  completado  boolean NOT NULL DEFAULT false,
  progreso    numeric NOT NULL DEFAULT 0,
  fecha_limit date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_objetivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_objetivos_own" ON crm_objetivos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_objetivos_perfil_anio ON crm_objetivos(perfil_id, anio);

-- ── Scorecard semanal ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_scorecard_semanal (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  semanas     jsonb NOT NULL DEFAULT '{}',
  metas       jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_scorecard_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_scorecard_semanal_own" ON crm_scorecard_semanal
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Cobros de comisiones (comisiones-pendientes) ──────────────────────────────

CREATE TABLE IF NOT EXISTS crm_comisiones_cobros (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  cobros      jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_comisiones_cobros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_comisiones_cobros_own" ON crm_comisiones_cobros
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Plantillas de mensajes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_plantillas_mensajes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  categoria   text NOT NULL DEFAULT 'general',
  contenido   text NOT NULL,
  variables   text[] NOT NULL DEFAULT '{}',
  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_plantillas_mensajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_plantillas_mensajes_own" ON crm_plantillas_mensajes
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_plantillas_perfil ON crm_plantillas_mensajes(perfil_id);

-- ── Campañas de marketing ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_campanas_marketing (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  campanas    jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_campanas_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_campanas_marketing_own" ON crm_campanas_marketing
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Campaña cumpleaños: config + felicitados + plantillas ─────────────────────

CREATE TABLE IF NOT EXISTS crm_campana_cumpleanos (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  config      jsonb NOT NULL DEFAULT '{}',
  felicitados jsonb NOT NULL DEFAULT '{}',
  plantillas  jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_campana_cumpleanos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_campana_cumpleanos_own" ON crm_campana_cumpleanos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Campaña reactivación: IDs de contactos ya reactivados ────────────────────

CREATE TABLE IF NOT EXISTS crm_campana_reactivacion (
  perfil_id    uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  reactivados  jsonb NOT NULL DEFAULT '[]',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_campana_reactivacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_campana_reactivacion_own" ON crm_campana_reactivacion
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Red de contactos ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_red_contactos (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  contactos   jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_red_contactos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_red_contactos_own" ON crm_red_contactos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Referidos ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_referidos (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  referidos   jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_referidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_referidos_own" ON crm_referidos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Seguimiento post-venta ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_seguimiento_post_venta (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  seguimientos jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_seguimiento_post_venta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_seguimiento_post_venta_own" ON crm_seguimiento_post_venta
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Checklists de cierre ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_checklists_cierre (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  checklists  jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_checklists_cierre ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_checklists_cierre_own" ON crm_checklists_cierre
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Propuestas comerciales ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_propuestas_comerciales (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  propuestas  jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_propuestas_comerciales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_propuestas_comerciales_own" ON crm_propuestas_comerciales
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Análisis competencia ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_analisis_competencia (
  perfil_id     uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  competidores  jsonb NOT NULL DEFAULT '[]',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_analisis_competencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_analisis_competencia_own" ON crm_analisis_competencia
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
