-- Migration 126: más amenities y campos de clasificación
-- toilettes, bicicletero, microcine, sauna, conserjería, portero eléctrico,
-- wifi comunes, espacio verde. Más disposicion/tipo_unidad/ocupacion para externas.

-- ── cartera_propiedades ────────────────────────────────────────────────────
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS toilettes               integer,
  ADD COLUMN IF NOT EXISTS com_bicicletero         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_microcine           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_sauna               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_conserjeria         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_portero_electrico   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_wifi_comunes        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_espacio_verde       boolean NOT NULL DEFAULT false;

-- ── propiedades_externas ───────────────────────────────────────────────────
ALTER TABLE propiedades_externas
  ADD COLUMN IF NOT EXISTS toilettes               integer,
  ADD COLUMN IF NOT EXISTS com_bicicletero         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_microcine           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_sauna               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_conserjeria         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_portero_electrico   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_wifi_comunes        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_espacio_verde       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS disposicion             text,
  ADD COLUMN IF NOT EXISTS tipo_unidad             text,
  ADD COLUMN IF NOT EXISTS ocupacion               text;

-- ── Actualizar v_propiedades_mercado ──────────────────────────────────────
DROP VIEW IF EXISTS v_propiedades_mercado;

CREATE VIEW v_propiedades_mercado AS

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
  toilettes,
  ambientes,
  superficie_cubierta,
  sup_terreno,
  sup_semicubierta,
  sup_descubierta,
  expensas,
  orientacion,
  disposicion,
  piso::text                                                    AS piso,
  estacionamientos                                              AS cocheras,
  bauleras::boolean                                             AS baulera,
  antiguedad,
  amoblado,
  acepta_mascotas,
  apto_credito,
  com_pileta,
  com_gimnasio,
  com_sum,
  com_ascensor,
  com_seguridad,
  com_parrilla,
  com_quincho,
  com_solarium,
  com_lavanderia                                                AS com_laundry,
  com_cowork,
  com_juegos_infantiles                                         AS com_juegos_ninos,
  com_bicicletero,
  com_microcine,
  com_sauna,
  com_conserjeria,
  com_portero_electrico,
  com_wifi_comunes,
  com_espacio_verde,
  amb_balcon,
  amb_terraza,
  amb_jardin,
  amb_patio,
  video_url,
  tour_virtual_url,
  NULL::text                                                    AS agente_nombre,
  NULL::text                                                    AS agente_telefono,
  NULL::text                                                    AS agente_email,
  NULL::text                                                    AS tipo_unidad,
  NULL::text                                                    AS ocupacion,
  (CASE WHEN fotos IS NOT NULL AND array_length(fotos, 1) > 0
        THEN fotos[1] ELSE NULL END)                            AS foto_principal,
  descripcion,
  '/crm/cartera/ficha/' || id::text                             AS url,
  perfil_id::text                                               AS propietario_id,
  estado,
  updated_at
FROM cartera_propiedades
WHERE estado IN ('activa', 'reservada')

UNION ALL

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
  toilettes,
  ambientes,
  superficie_cubierta,
  sup_terreno,
  sup_semicubierta,
  sup_descubierta,
  expensas,
  orientacion,
  disposicion,
  piso::text                                                    AS piso,
  cocheras,
  baulera,
  antiguedad,
  amoblado,
  acepta_mascotas,
  apto_credito,
  com_pileta,
  com_gimnasio,
  com_sum,
  com_ascensor,
  com_seguridad,
  com_parrilla,
  com_quincho,
  com_solarium,
  com_laundry,
  com_cowork,
  com_juegos_ninos,
  com_bicicletero,
  com_microcine,
  com_sauna,
  com_conserjeria,
  com_portero_electrico,
  com_wifi_comunes,
  com_espacio_verde,
  amb_balcon,
  amb_terraza,
  amb_jardin,
  amb_patio,
  video_url,
  tour_virtual_url,
  agente_nombre,
  agente_telefono,
  agente_email,
  tipo_unidad,
  ocupacion,
  (CASE WHEN imagenes IS NOT NULL AND jsonb_typeof(imagenes) = 'array' AND jsonb_array_length(imagenes) > 0
        THEN imagenes ->> 0 ELSE NULL END)                      AS foto_principal,
  descripcion,
  url,
  NULL::text                                                    AS propietario_id,
  'activa'                                                      AS estado,
  synced_at                                                     AS updated_at
FROM propiedades_externas
WHERE activa = true;

GRANT SELECT ON v_propiedades_mercado TO authenticated;

-- ── Actualizar función de reparación ──────────────────────────────────────
CREATE OR REPLACE FUNCTION reparar_vista_mercado_normalizada()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DROP VIEW IF EXISTS v_propiedades_mercado;

  CREATE VIEW v_propiedades_mercado AS
  SELECT
    id::text AS id, 'gfi' AS fuente, 'gfi' AS red, titulo,
    LOWER(operacion) AS operacion, LOWER(tipo) AS tipo,
    precio, moneda, zona AS barrio, ciudad, 'Santa Fe'::text AS provincia,
    direccion, latitud AS lat, longitud AS lng,
    dormitorios, banos, toilettes, ambientes,
    superficie_cubierta, sup_terreno, sup_semicubierta, sup_descubierta, expensas,
    orientacion, disposicion, piso::text AS piso,
    estacionamientos AS cocheras, bauleras::boolean AS baulera, antiguedad,
    amoblado, acepta_mascotas, apto_credito,
    com_pileta, com_gimnasio, com_sum, com_ascensor, com_seguridad,
    com_parrilla, com_quincho, com_solarium, com_lavanderia AS com_laundry,
    com_cowork, com_juegos_infantiles AS com_juegos_ninos,
    com_bicicletero, com_microcine, com_sauna, com_conserjeria,
    com_portero_electrico, com_wifi_comunes, com_espacio_verde,
    amb_balcon, amb_terraza, amb_jardin, amb_patio,
    video_url, tour_virtual_url,
    NULL::text AS agente_nombre, NULL::text AS agente_telefono, NULL::text AS agente_email,
    NULL::text AS tipo_unidad, NULL::text AS ocupacion,
    (CASE WHEN fotos IS NOT NULL AND array_length(fotos, 1) > 0 THEN fotos[1] ELSE NULL END) AS foto_principal,
    descripcion, '/crm/cartera/ficha/' || id::text AS url,
    perfil_id::text AS propietario_id, estado, updated_at
  FROM cartera_propiedades WHERE estado IN ('activa', 'reservada')
  UNION ALL
  SELECT
    id::text AS id, portal AS fuente, portal AS red, titulo,
    operacion, tipo, precio, moneda, barrio, ciudad, provincia,
    direccion, lat, lng, dormitorios, banos, toilettes, ambientes,
    superficie_cubierta, sup_terreno, sup_semicubierta, sup_descubierta, expensas,
    orientacion, disposicion, piso::text AS piso, cocheras, baulera, antiguedad,
    amoblado, acepta_mascotas, apto_credito,
    com_pileta, com_gimnasio, com_sum, com_ascensor, com_seguridad,
    com_parrilla, com_quincho, com_solarium, com_laundry, com_cowork, com_juegos_ninos,
    com_bicicletero, com_microcine, com_sauna, com_conserjeria,
    com_portero_electrico, com_wifi_comunes, com_espacio_verde,
    amb_balcon, amb_terraza, amb_jardin, amb_patio,
    video_url, tour_virtual_url, agente_nombre, agente_telefono, agente_email,
    tipo_unidad, ocupacion,
    (CASE WHEN imagenes IS NOT NULL AND jsonb_typeof(imagenes) = 'array' AND jsonb_array_length(imagenes) > 0
          THEN imagenes ->> 0 ELSE NULL END) AS foto_principal,
    descripcion, url, NULL::text AS propietario_id, 'activa' AS estado,
    synced_at AS updated_at
  FROM propiedades_externas WHERE activa = true;

  GRANT SELECT ON v_propiedades_mercado TO authenticated;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION reparar_vista_mercado_normalizada() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reparar_vista_mercado_normalizada() TO service_role;
