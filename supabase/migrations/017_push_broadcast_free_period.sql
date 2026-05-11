-- Push broadcast log
CREATE TABLE IF NOT EXISTS push_broadcasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES perfiles(id),
  titulo text NOT NULL,
  cuerpo text NOT NULL,
  url text,
  filtro text NOT NULL DEFAULT 'todos',
  enviados integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_push_broadcasts" ON push_broadcasts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_push_broadcasts_created_at ON push_broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_broadcasts_admin_id  ON push_broadcasts(admin_id);

-- Free period: admin inserts/updates the 'free_until' key in indicadores (date string ISO)
-- No new table needed — reuses existing indicadores table
-- Example: INSERT INTO indicadores(clave, valor) VALUES ('free_until', '2026-06-01') ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
