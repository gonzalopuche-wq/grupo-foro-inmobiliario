-- ─────────────────────────────────────────────────────────────────────────────
-- 016 · Firma Digital + Email bidireccional desde CRM
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Firmas digitales ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_firmas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id      UUID REFERENCES crm_negocios(id) ON DELETE SET NULL,
  contacto_id     UUID REFERENCES crm_contactos(id) ON DELETE SET NULL,
  titulo          TEXT NOT NULL,
  firmante_nombre TEXT,
  imagen_base64   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_firmas_perfil_id   ON crm_firmas(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_firmas_contacto_id ON crm_firmas(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_firmas_negocio_id  ON crm_firmas(negocio_id);

ALTER TABLE crm_firmas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firmas_owner" ON crm_firmas;
CREATE POLICY "firmas_owner" ON crm_firmas
  FOR ALL USING (perfil_id = auth.uid());

-- ── 2. Log de emails enviados desde CRM ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contacto_id   UUID REFERENCES crm_contactos(id) ON DELETE SET NULL,
  negocio_id    UUID REFERENCES crm_negocios(id) ON DELETE SET NULL,
  para          TEXT NOT NULL,
  asunto        TEXT NOT NULL,
  cuerpo        TEXT NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'enviado',   -- enviado | error
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_emails_perfil_id   ON crm_emails(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_emails_contacto_id ON crm_emails(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_emails_negocio_id  ON crm_emails(negocio_id);

ALTER TABLE crm_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emails_owner" ON crm_emails;
CREATE POLICY "emails_owner" ON crm_emails
  FOR ALL USING (perfil_id = auth.uid());
