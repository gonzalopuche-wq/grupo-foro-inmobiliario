-- Vista unificada de propiedades de mercado
-- Une cartera GFI (propia) + propiedades externas (ZP, AP, ML, etc.)
-- Permite buscar todo el mercado de la 2da circunscripción COCIR en un solo lugar

DROP VIEW IF EXISTS v_propiedades_mercado;

CREATE VIEW v_propiedades_mercado AS

-- ── Cartera GFI (propiedades propias de corredores GFI) ──────────────────────
SELECT
  id::text                                                      AS id,
  'gfi'                                                         AS fuente,
  'gfi'                                                         AS red,
  titulo,
  operacion,
  tipo,
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
  ambientes,
  superficie_cubierta,
  sup_terreno,
  expensas,
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

-- ── Propiedades externas (ZonaProp, Argenprop, MercadoLibre, etc.) ───────────
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
  sup_terreno,
  expensas,
  (
    CASE
      WHEN imagenes IS NOT NULL AND jsonb_typeof(imagenes) = 'array' AND jsonb_array_length(imagenes) > 0
      THEN imagenes ->> 0
      ELSE NULL
    END
  )                                                             AS foto_principal,
  descripcion,
  url,
  NULL                                                          AS propietario_id,
  'activa'                                                      AS estado,
  synced_at                                                     AS updated_at
FROM propiedades_externas
WHERE activa = true;

-- Permisos: solo usuarios autenticados pueden leer la vista
GRANT SELECT ON v_propiedades_mercado TO authenticated;
