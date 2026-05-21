-- Agrega columna celular a cocir_padron para separar teléfono fijo de celular
ALTER TABLE cocir_padron ADD COLUMN IF NOT EXISTS celular text;
