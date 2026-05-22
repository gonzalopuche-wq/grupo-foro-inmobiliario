-- Agrega columna created_by a crm_leads y cartera_visitas
-- Permite identificar qué agente/colaborador creó el registro
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE cartera_visitas
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES perfiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_created_by
  ON crm_leads(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cartera_visitas_created_by
  ON cartera_visitas(created_by) WHERE created_by IS NOT NULL;
