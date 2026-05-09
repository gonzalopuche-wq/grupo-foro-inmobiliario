-- Columnas OAuth de MercadoLibre en portal_credenciales
ALTER TABLE portal_credenciales
  ADD COLUMN IF NOT EXISTS ml_app_id           text,
  ADD COLUMN IF NOT EXISTS ml_app_secret       text,
  ADD COLUMN IF NOT EXISTS ml_access_token     text,
  ADD COLUMN IF NOT EXISTS ml_refresh_token    text,
  ADD COLUMN IF NOT EXISTS ml_token_expires_at timestamptz;
