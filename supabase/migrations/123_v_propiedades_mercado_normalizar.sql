-- Actualiza v_propiedades_mercado para normalizar operacion y tipo a minúsculas
-- en el lado de cartera_propiedades (que guarda "Venta", "Departamento", etc.)
-- Los portales externos ya guardan en minúsculas.
-- Esto asegura que los filtros con eq("operacion","venta") funcionen para GFI.

DROP VIEW IF EXISTS v_propiedades_mercado;

CREATE VIEW v_propiedades_mercado AS

-- ── Cartera GFI ──────────────────────────────────────────────────────────────
SELECT
  id::text                                                      AS id,
  'gfi'                                                         AS fuente,
  'gfi'                                                         AS red,
  titulo,
  LOWER(operacion)                                              AS operacion,
  LOWER(tipo)                                                   AS tipo,
  precio,
  moneda,
  zona                                                          AS barrio,
  ciudad,
  'Santa Fe'::text                                              AS provincia,
  direccion,
  latitud                                                       AS lat,
  longitud                                                      AS lng,
  dormitorios,
  banos,
  NULL::integer                                                 AS ambientes,
  superficie_cubierta,
  NULL::numeric                                                 AS sup_terreno,
  NULL::numeric                                                 AS expensas,
  (
    CASE
      WHEN fotos IS NOT NULL AND array_length(fotos, 1) > 0
      THEN fotos[1]
      ELSE NULL
    END
  )                                                             AS foto_principal,
  descripcion,
  '/crm/cartera/ficha/' || id::text                             AS url,
  perfil_id::text                                               AS propietario_id,
  estado,
  updated_at
FROM cartera_propiedades
WHERE estado IN ('activa', 'reservada')

UNION ALL

-- ── Propiedades externas (ya en minúsculas) ───────────────────────────────────
SELECT
  id::text                                                      AS id,
  portal                                                        AS fuente,
  portal                                                        AS red,
  titulo,
  operacion,
  tipo,
  precio,
  moneda,
  barrio,
  ciudad,
  provincia,
  direccion,
  lat,
  lng,
  dormitorios,
  banos,
  ambientes,
  superficie_cubierta,
  NULL::numeric                                                 AS sup_terreno,
  NULL::numeric                                                 AS expensas,
  (
    CASE
      WHEN imagenes IS NOT NULL AND jsonb_typeof(imagenes) = 'array' AND jsonb_array_length(imagenes) > 0
      THEN imagenes ->> 0
      ELSE NULL
    END
  )                                                             AS foto_principal,
  descripcion,
  url,
  NULL::text                                                    AS propietario_id,
  'activa'                                                      AS estado,
  synced_at                                                     AS updated_at
FROM propiedades_externas
WHERE activa = true;

GRANT SELECT ON v_propiedades_mercado TO authenticated;
