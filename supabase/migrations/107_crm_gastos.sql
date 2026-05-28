-- Migration 107: crm_gastos — gastos operativos del corredor

CREATE TABLE IF NOT EXISTS crm_gastos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  categoria   text NOT NULL DEFAULT 'Otros',
  monto       numeric NOT NULL CHECK (monto >= 0),
  moneda      text NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS','USD','EUR')),
  fecha       date NOT NULL,
  recurrente  boolean NOT NULL DEFAULT false,
  pagado      boolean NOT NULL DEFAULT false,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_gastos_own_all" ON crm_gastos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "crm_gastos_admin_all" ON crm_gastos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_crm_gastos_perfil_fecha ON crm_gastos(perfil_id, fecha);
