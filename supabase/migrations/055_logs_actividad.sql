-- MOD 79: Logs de Actividad — registro de eventos del sistema para auditoría
CREATE TABLE IF NOT EXISTS logs_actividad (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  accion     text NOT NULL,
  modulo     text,
  detalle    text,
  ip         text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_actividad_user   ON logs_actividad(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_actividad_accion ON logs_actividad(accion);
CREATE INDEX IF NOT EXISTS idx_logs_actividad_fecha  ON logs_actividad(created_at DESC);

ALTER TABLE logs_actividad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_admin_read" ON logs_actividad;
CREATE POLICY "logs_admin_read" ON logs_actividad
  FOR SELECT USING (
    (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "logs_insert" ON logs_actividad;
CREATE POLICY "logs_insert" ON logs_actividad
  FOR INSERT WITH CHECK (true);
