-- Migration 085: Precio anterior para mostrar baja de precio
-- Cuando precio_anterior > precio, la ficha pública muestra el precio original
-- tachado y el porcentaje de descuento (como Argenprop).

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS precio_anterior numeric(15,2);
