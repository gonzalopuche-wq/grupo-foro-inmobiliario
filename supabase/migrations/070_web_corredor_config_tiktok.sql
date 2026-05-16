-- Migration 070: agregar columna tiktok a web_corredor_config

ALTER TABLE web_corredor_config
  ADD COLUMN IF NOT EXISTS tiktok text;
