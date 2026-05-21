-- Migration 089: Agregar company_id y provider a portal_credenciales para Propia MLS
ALTER TABLE portal_credenciales
  ADD COLUMN IF NOT EXISTS propia_company_id text,
  ADD COLUMN IF NOT EXISTS propia_provider text;
