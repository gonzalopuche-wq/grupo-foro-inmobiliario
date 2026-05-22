-- Agregar fecha_nacimiento a crm_contactos
-- Necesaria para el módulo de campaña de cumpleaños y recordatorios

ALTER TABLE crm_contactos
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

CREATE INDEX IF NOT EXISTS idx_crm_contactos_nacimiento
  ON crm_contactos (fecha_nacimiento)
  WHERE fecha_nacimiento IS NOT NULL;
