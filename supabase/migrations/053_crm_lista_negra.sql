-- MOD 133: Lista Negra / Alertas CRM
CREATE TABLE IF NOT EXISTS crm_lista_negra (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  documento   text,                        -- DNI / CUIT opcional
  tipo        text DEFAULT 'persona',      -- persona | empresa
  motivo      text NOT NULL,
  nivel       text DEFAULT 'medio',        -- bajo | medio | alto
  alerta      boolean DEFAULT true,        -- notificar si aparece en MIR/CRM
  notas       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lista_negra_perfil ON crm_lista_negra(perfil_id);
CREATE INDEX IF NOT EXISTS idx_lista_negra_nombre ON crm_lista_negra(nombre);

ALTER TABLE crm_lista_negra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_lista_negra" ON crm_lista_negra;
CREATE POLICY "user_own_lista_negra" ON crm_lista_negra
  FOR ALL USING (
    perfil_id = auth.uid()
    OR (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
  );
