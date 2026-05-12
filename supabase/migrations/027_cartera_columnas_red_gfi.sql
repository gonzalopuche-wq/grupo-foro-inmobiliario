-- Columnas de Red GFI que la migración 005 agrega pero que no estaban
-- en la tabla creada manualmente. Idempotente con IF NOT EXISTS.
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS compartir_en_red  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mir_ofrecido_id   uuid REFERENCES mir_ofrecidos(id) ON DELETE SET NULL;
