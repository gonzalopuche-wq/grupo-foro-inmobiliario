-- Migration 087: origen + externo_id en crm_listas_busqueda para sincronización de portales
ALTER TABLE crm_listas_busqueda
  ADD COLUMN IF NOT EXISTS origen     text,
  ADD COLUMN IF NOT EXISTS externo_id text;

-- Índice único para upsert por (corredor, id externo) — evita duplicados al re-sincronizar
CREATE UNIQUE INDEX IF NOT EXISTS idx_clb_externo
  ON crm_listas_busqueda(corredor_id, externo_id)
  WHERE externo_id IS NOT NULL;
