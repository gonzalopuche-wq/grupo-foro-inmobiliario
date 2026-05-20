-- Migration 086: Credenciales de Propia MLS en portal_credenciales
ALTER TABLE portal_credenciales
  ADD COLUMN IF NOT EXISTS propia_api_key text,
  ADD COLUMN IF NOT EXISTS propia_usuario text;
