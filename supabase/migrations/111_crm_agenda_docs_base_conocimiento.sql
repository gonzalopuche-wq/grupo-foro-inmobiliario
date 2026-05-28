-- Migration 111: agenda visitas/tasaciones, documentos, base conocimiento,
--                reportes propietarios, duplicados descartados

-- ── Agenda de visitas personalizada ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_agenda_visitas (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  visitas    jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_agenda_visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_agenda_visitas_own" ON crm_agenda_visitas
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Agenda de tasaciones ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_agenda_tasaciones (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  tasaciones jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_agenda_tasaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_agenda_tasaciones_own" ON crm_agenda_tasaciones
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Gestión de documentos ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_gestion_documentos (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  documentos  jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_gestion_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_gestion_documentos_own" ON crm_gestion_documentos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Base de conocimiento ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_base_conocimiento (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  articulos  jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_base_conocimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_base_conocimiento_own" ON crm_base_conocimiento
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Reportes propietarios (datos por mes) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_reportes_propietarios (
  perfil_id    uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  reportes     jsonb NOT NULL DEFAULT '{}',
  asignaciones jsonb NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_reportes_propietarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_reportes_propietarios_own" ON crm_reportes_propietarios
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Duplicados descartados ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_duplicados_descartados (
  perfil_id    uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  descartados  jsonb NOT NULL DEFAULT '[]',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_duplicados_descartados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_duplicados_descartados_own" ON crm_duplicados_descartados
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
