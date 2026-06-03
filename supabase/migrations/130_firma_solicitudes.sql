-- MIGRACIÓN 130: firma_solicitudes (firma digital por email)

CREATE TABLE IF NOT EXISTS firma_solicitudes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id  uuid REFERENCES crm_contratos(id) ON DELETE SET NULL,
  titulo       text NOT NULL,
  html_doc     text,
  firmantes    jsonb NOT NULL DEFAULT '[]',
  estado       text NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','parcial','completado','cancelado')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE firma_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firma_sol_own_all" ON firma_solicitudes
  FOR ALL TO authenticated
  USING (perfil_id = auth.uid())
  WITH CHECK (perfil_id = auth.uid());

CREATE POLICY "firma_sol_anon_read" ON firma_solicitudes
  FOR SELECT TO anon USING (true);

CREATE POLICY "firma_sol_anon_update" ON firma_solicitudes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_firma_sol_perfil   ON firma_solicitudes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_firma_sol_contrato ON firma_solicitudes(contrato_id);
