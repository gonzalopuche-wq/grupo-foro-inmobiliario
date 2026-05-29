-- Deslinde de responsabilidades: IP de registro, aceptación de términos, y logs de login

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS acepto_terminos     boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS acepto_terminos_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_registro         text        DEFAULT NULL;

-- Asegurar que logs_actividad exista (ya creada en 055, esto es idempotente)
CREATE TABLE IF NOT EXISTS logs_actividad (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES perfiles(id) ON DELETE SET NULL,
  accion     text        NOT NULL,
  modulo     text,
  detalle    text,
  ip         text,
  created_at timestamptz DEFAULT now()
);

-- Índices para consultas de auditoría
CREATE INDEX IF NOT EXISTS logs_actividad_user_id_idx    ON logs_actividad(user_id);
CREATE INDEX IF NOT EXISTS logs_actividad_created_at_idx ON logs_actividad(created_at DESC);
CREATE INDEX IF NOT EXISTS logs_actividad_accion_idx     ON logs_actividad(accion);

-- RLS: solo admins pueden leer, service_role puede insertar
ALTER TABLE logs_actividad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_actividad_admin_select" ON logs_actividad;
CREATE POLICY "logs_actividad_admin_select" ON logs_actividad
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid() AND tipo IN ('admin', 'master')
    )
  );

-- Service role bypasses RLS — los inserts se hacen siempre con service role key
