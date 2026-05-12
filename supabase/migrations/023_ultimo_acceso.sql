-- Agrega campo ultimo_acceso a perfiles para tracking de usuarios en línea
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultimo_acceso timestamptz;

-- Permite que cada usuario actualice su propio ultimo_acceso
-- (la política de UPDATE general ya debería existir; esta es específica por si no)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'perfiles' AND policyname = 'perfiles_update_own'
  ) THEN
    CREATE POLICY perfiles_update_own ON perfiles
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;
