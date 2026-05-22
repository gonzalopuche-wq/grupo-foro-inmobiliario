-- Migration 104: columnas de tracking para sync cartera ↔ Propia MLS

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS propia_id        text,
  ADD COLUMN IF NOT EXISTS propia_sync_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_cartera_propia_id ON cartera_propiedades(perfil_id, propia_id)
  WHERE propia_id IS NOT NULL;
