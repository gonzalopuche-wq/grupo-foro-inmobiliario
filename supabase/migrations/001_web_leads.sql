-- web_leads: leads generados desde la web pública del corredor
CREATE TABLE IF NOT EXISTS web_leads (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id            uuid        REFERENCES perfiles(id) ON DELETE CASCADE,
  slug                 text        NOT NULL,
  tipo                 text        NOT NULL CHECK (tipo IN ('contacto', 'tasacion')),
  nombre               text        NOT NULL,
  email                text,
  telefono             text,
  mensaje              text,
  direccion_propiedad  text,
  leido                boolean     DEFAULT false,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_leads_perfil_id ON web_leads(perfil_id);
CREATE INDEX IF NOT EXISTS idx_web_leads_created_at ON web_leads(created_at DESC);

ALTER TABLE web_leads ENABLE ROW LEVEL SECURITY;

-- El corredor ve solo sus propios leads
CREATE POLICY "corredor_ve_sus_leads"
  ON web_leads FOR SELECT
  USING (auth.uid() = perfil_id);

-- El corredor puede marcar como leído
CREATE POLICY "corredor_actualiza_sus_leads"
  ON web_leads FOR UPDATE
  USING (auth.uid() = perfil_id);

-- Inserción pública (sin autenticar) via service_role desde la API
-- La API /api/web-contacto usa service_role key, así que no necesita policy para INSERT
