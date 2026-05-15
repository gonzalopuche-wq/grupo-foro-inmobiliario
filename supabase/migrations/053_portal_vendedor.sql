-- MOD 94: Portal Vendedor — portal seguro para que el dueño de la propiedad
-- pueda ver el estado de su operación sin necesidad de login.
CREATE TABLE IF NOT EXISTS crm_portal_vendedor (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corredor_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  token               text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  propiedad_id        uuid,   -- referencia blanda (no FK para evitar cascada)
  negocio_id          uuid,
  vendedor_nombre     text NOT NULL,
  vendedor_email      text,
  vendedor_telefono   text,
  titulo              text NOT NULL,
  mensaje_bienvenida  text,
  etapa_actual        text,
  activo              boolean DEFAULT true,
  vistas              integer DEFAULT 0,
  expires_at          timestamptz,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_portal_vendedor_novedades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id   uuid NOT NULL REFERENCES crm_portal_vendedor(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  contenido   text,
  tipo        text DEFAULT 'nota',   -- nota | visita | oferta | escritura | otro
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_vendedor_corredor ON crm_portal_vendedor(corredor_id);
CREATE INDEX IF NOT EXISTS idx_portal_vendedor_token    ON crm_portal_vendedor(token);
CREATE INDEX IF NOT EXISTS idx_portal_novedades_portal  ON crm_portal_vendedor_novedades(portal_id);

ALTER TABLE crm_portal_vendedor          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_portal_vendedor_novedades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corredor_own_portal" ON crm_portal_vendedor;
CREATE POLICY "corredor_own_portal" ON crm_portal_vendedor
  FOR ALL USING (
    corredor_id = auth.uid()
    OR (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "corredor_own_novedades" ON crm_portal_vendedor_novedades;
CREATE POLICY "corredor_own_novedades" ON crm_portal_vendedor_novedades
  FOR ALL USING (
    (SELECT corredor_id FROM crm_portal_vendedor WHERE id = portal_id) = auth.uid()
    OR (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
  );

-- Acceso público de lectura para el portal (via token, sin login)
DROP POLICY IF EXISTS "public_read_portal" ON crm_portal_vendedor;
CREATE POLICY "public_read_portal" ON crm_portal_vendedor
  FOR SELECT USING (activo = true);

DROP POLICY IF EXISTS "public_read_novedades" ON crm_portal_vendedor_novedades;
CREATE POLICY "public_read_novedades" ON crm_portal_vendedor_novedades
  FOR SELECT USING (true);
