-- api_keys: autenticación SHA-256, scopes, prefijo visible, contador de uso
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  key_hash    text NOT NULL,
  prefijo     text NOT NULL,
  scopes      text[] NOT NULL DEFAULT ARRAY['propiedades:write'],
  activa      boolean NOT NULL DEFAULT true,
  ultimo_uso  timestamptz,
  cant_usos   bigint NOT NULL DEFAULT 0,
  creada_por  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_perfil ON api_keys(perfil_id, activa);

-- Incremento atómico de uso (llamado desde service role)
CREATE OR REPLACE FUNCTION incrementar_uso_api_key(p_key_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE api_keys
  SET ultimo_uso = now(), cant_usos = cant_usos + 1
  WHERE id = p_key_id;
$$;

-- cartera_propiedades: columnas para integración UrbixPro + KiteProp
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS external_id      text,
  ADD COLUMN IF NOT EXISTS kiteprop_id      text,
  ADD COLUMN IF NOT EXISTS kiteprop_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS origen           text DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cartera_perfil_external_id
  ON cartera_propiedades(perfil_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cartera_origen ON cartera_propiedades(origen);

-- api_logs: registro de cada llamada para diagnóstico
CREATE TABLE IF NOT EXISTS api_logs (
  id            bigserial PRIMARY KEY,
  api_key_id    uuid REFERENCES api_keys(id),
  perfil_id     uuid REFERENCES perfiles(id),
  metodo        text,
  ruta          text,
  http_status   int,
  body_req      jsonb,
  body_res      jsonb,
  ip            text,
  duracion_ms   int,
  fecha         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_logs_fecha  ON api_logs(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_perfil ON api_logs(perfil_id, fecha DESC);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_own_all" ON api_keys
  FOR ALL USING (perfil_id = auth.uid());

CREATE POLICY "api_keys_admin_all" ON api_keys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_logs_own_select" ON api_logs
  FOR SELECT USING (perfil_id = auth.uid());

CREATE POLICY "api_logs_admin_all" ON api_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );
