-- Migration 128: Link tracking para propiedades

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
