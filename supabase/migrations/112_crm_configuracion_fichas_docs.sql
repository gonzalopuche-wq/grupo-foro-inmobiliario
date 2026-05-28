-- Migration 112: configuración CRM, fichas propiedades, documentos estado,
--                expedientes

-- ── Configuración CRM extra (preferencias + datos agencia) ───────────────────

CREATE TABLE IF NOT EXISTS crm_configuracion (
  perfil_id    uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  config_extra jsonb NOT NULL DEFAULT '{}',
  datos_agencia jsonb NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_configuracion_own" ON crm_configuracion
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Fichas de propiedades ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_fichas_propiedades (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  fichas     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_fichas_propiedades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_fichas_propiedades_own" ON crm_fichas_propiedades
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Documentos estado ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_documentos_estado (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  estado     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_documentos_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_documentos_estado_own" ON crm_documentos_estado
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

-- ── Expedientes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_expedientes (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  expedientes jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_expedientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_expedientes_own" ON crm_expedientes
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
