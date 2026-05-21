-- Recrear políticas RLS de forma idempotente (DROP IF EXISTS + CREATE)
-- Necesario porque CREATE POLICY no soporta IF NOT EXISTS en PostgreSQL

-- api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_own_all"   ON api_keys;
DROP POLICY IF EXISTS "api_keys_admin_all" ON api_keys;

CREATE POLICY "api_keys_own_all" ON api_keys
  FOR ALL USING (perfil_id = auth.uid());

CREATE POLICY "api_keys_admin_all" ON api_keys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

-- api_logs
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_logs_own_select" ON api_logs;
DROP POLICY IF EXISTS "api_logs_admin_all"  ON api_logs;

CREATE POLICY "api_logs_own_select" ON api_logs
  FOR SELECT USING (perfil_id = auth.uid());

CREATE POLICY "api_logs_admin_all" ON api_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );
