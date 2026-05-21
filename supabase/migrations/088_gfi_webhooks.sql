-- Webhooks salientes de GFI: endpoints externos que reciben eventos
CREATE TABLE IF NOT EXISTS gfi_webhooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  url           text NOT NULL,
  secret        text NOT NULL,
  eventos       text[] NOT NULL DEFAULT '{}',
  activo        boolean NOT NULL DEFAULT true,
  ultimo_envio  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gfi_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_own"   ON gfi_webhooks FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "wh_admin" ON gfi_webhooks FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_gfi_webhooks_perfil ON gfi_webhooks(perfil_id);

-- Log de entregas de webhook
CREATE TABLE IF NOT EXISTS gfi_webhooks_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id  uuid REFERENCES gfi_webhooks(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL,
  evento      text NOT NULL,
  status_code int,
  ok          boolean NOT NULL,
  duracion_ms int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gfi_webhooks_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whl_own"   ON gfi_webhooks_log FOR ALL USING (auth.uid() = perfil_id);
CREATE POLICY "whl_admin" ON gfi_webhooks_log FOR ALL USING (es_admin_gfi());
CREATE INDEX IF NOT EXISTS idx_gfi_webhooks_log_wh ON gfi_webhooks_log(webhook_id);
