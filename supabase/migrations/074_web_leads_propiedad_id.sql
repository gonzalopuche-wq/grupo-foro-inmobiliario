-- Link web leads to the specific property that generated them
ALTER TABLE web_leads
  ADD COLUMN IF NOT EXISTS propiedad_id uuid REFERENCES cartera_propiedades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_web_leads_propiedad_id ON web_leads(propiedad_id);
