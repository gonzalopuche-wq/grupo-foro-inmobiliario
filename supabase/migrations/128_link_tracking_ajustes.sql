-- Migration 128: Link tracking para propiedades + campos email contratos

-- ── property_link_views: URLs rastreables por propiedad ─────────────────────
CREATE TABLE IF NOT EXISTS property_link_views (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  propiedad_id  uuid NOT NULL,
  codigo        text NOT NULL,
  titulo        text,
  vistas        integer NOT NULL DEFAULT 0,
  primer_vista_at timestamptz,
  ultima_vista_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, propiedad_id)
);

CREATE INDEX IF NOT EXISTS idx_plv_codigo    ON property_link_views(codigo);
CREATE INDEX IF NOT EXISTS idx_plv_perfil    ON property_link_views(perfil_id);
CREATE INDEX IF NOT EXISTS idx_plv_propiedad ON property_link_views(propiedad_id);

ALTER TABLE property_link_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plv_own_select" ON property_link_views
  FOR SELECT TO authenticated USING (perfil_id = auth.uid());
CREATE POLICY "plv_own_insert" ON property_link_views
  FOR INSERT TO authenticated WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "plv_own_update" ON property_link_views
  FOR UPDATE TO authenticated USING (perfil_id = auth.uid());
CREATE POLICY "plv_service_all" ON property_link_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Agregar email de inquilino/propietario a contratos ───────────────────────
ALTER TABLE crm_contratos
  ADD COLUMN IF NOT EXISTS inquilino_email    text,
  ADD COLUMN IF NOT EXISTS propietario_email  text;

-- ── crm_ajustes_historico: auditoría de ajustes de alquiler ─────────────────
CREATE TABLE IF NOT EXISTS crm_ajustes_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contrato_id     uuid NOT NULL REFERENCES crm_contratos(id) ON DELETE CASCADE,
  monto_anterior  numeric NOT NULL,
  monto_nuevo     numeric NOT NULL,
  indice          text NOT NULL,
  porcentaje      numeric,
  fecha_ajuste    date NOT NULL,
  aplicado        boolean NOT NULL DEFAULT false,
  aplicado_at     timestamptz,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cah_contrato ON crm_ajustes_historico(contrato_id);
CREATE INDEX IF NOT EXISTS idx_cah_perfil   ON crm_ajustes_historico(perfil_id);

ALTER TABLE crm_ajustes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cah_own_all" ON crm_ajustes_historico
  FOR ALL TO authenticated USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
CREATE POLICY "cah_service_all" ON crm_ajustes_historico
  FOR ALL TO service_role USING (true) WITH CHECK (true);
