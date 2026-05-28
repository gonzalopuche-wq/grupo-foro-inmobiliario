-- Migration 110: objetivos mensuales y gestión de tareas (JSONB)

-- ── Objetivos mensuales ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_objetivos_mensuales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio       int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  objetivos  jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, anio, mes)
);
ALTER TABLE crm_objetivos_mensuales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_objetivos_mensuales_own" ON crm_objetivos_mensuales
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_obj_mensuales_perfil_anio
  ON crm_objetivos_mensuales(perfil_id, anio, mes);

-- ── Gestión de tareas personalizada (modelo diferente a crm_tareas) ───────────

CREATE TABLE IF NOT EXISTS crm_gestion_tareas (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  tareas     jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_gestion_tareas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_gestion_tareas_own" ON crm_gestion_tareas
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
