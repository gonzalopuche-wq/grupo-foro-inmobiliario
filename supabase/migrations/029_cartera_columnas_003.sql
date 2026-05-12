-- Columnas de migración 003 que nunca se aplicaron a la tabla
-- cartera_propiedades creada manualmente. Idempotente con IF NOT EXISTS.
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS contacto_propietario_id uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ci_url                  text,
  ADD COLUMN IF NOT EXISTS ci_fecha_obtencion      date,
  ADD COLUMN IF NOT EXISTS ci_fecha_vencimiento    date,
  ADD COLUMN IF NOT EXISTS ci_numero               text,
  ADD COLUMN IF NOT EXISTS ci_observaciones        text,
  ADD COLUMN IF NOT EXISTS escritura_url           text,
  ADD COLUMN IF NOT EXISTS plano_url               text,
  ADD COLUMN IF NOT EXISTS reglamento_url          text,
  ADD COLUMN IF NOT EXISTS api_ninios              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS api_ninios_numero       text,
  ADD COLUMN IF NOT EXISTS url_portal_origen       text,
  ADD COLUMN IF NOT EXISTS ambientes               integer;
