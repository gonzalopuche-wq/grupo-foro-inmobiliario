-- API pública de GFI por usuario: tabla de suscripciones y claves
CREATE TABLE IF NOT EXISTS gfi_api_suscripciones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id      uuid UNIQUE NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  api_key        text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  habilitada     boolean DEFAULT false,
  habilitada_at  timestamptz,
  precio_mensual integer DEFAULT 50000,
  notas          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gfi_api_suscripciones_api_key_idx ON gfi_api_suscripciones(api_key);

ALTER TABLE gfi_api_suscripciones ENABLE ROW LEVEL SECURITY;

-- Admin/master: acceso total
CREATE POLICY "api_sus_admin_all" ON gfi_api_suscripciones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
        AND perfiles.tipo IN ('admin', 'master')
    )
  );

-- Usuario: solo ve su propia fila
CREATE POLICY "api_sus_user_select" ON gfi_api_suscripciones
  FOR SELECT USING (perfil_id = auth.uid());
