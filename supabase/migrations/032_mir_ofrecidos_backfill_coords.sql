-- Backfill coordenadas en mir_ofrecidos desde cartera_propiedades
UPDATE mir_ofrecidos mo
SET
  latitud  = cp.latitud,
  longitud = cp.longitud
FROM cartera_propiedades cp
WHERE mo.cartera_id = cp.id
  AND (mo.latitud IS NULL OR mo.longitud IS NULL)
  AND cp.latitud  IS NOT NULL
  AND cp.longitud IS NOT NULL;
