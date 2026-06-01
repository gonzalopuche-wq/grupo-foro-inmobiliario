-- Migration 125: Enriquecer propiedades_externas con todos los campos
-- que ya tiene cartera_propiedades y que Kiteprop/Tokko exponen en sus APIs

-- ── Características físicas ───────────────────────────────────────────────
ALTER TABLE propiedades_externas
  ADD COLUMN IF NOT EXISTS orientacion       text,
  ADD COLUMN IF NOT EXISTS piso              integer,
  ADD COLUMN IF NOT EXISTS cocheras          integer,
  ADD COLUMN IF NOT EXISTS baulera           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS antiguedad        text,
  ADD COLUMN IF NOT EXISTS sup_semicubierta  numeric,
  ADD COLUMN IF NOT EXISTS sup_descubierta   numeric;

-- ── Condiciones ───────────────────────────────────────────────────────────
ALTER TABLE propiedades_externas
  ADD COLUMN IF NOT EXISTS amoblado          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acepta_mascotas   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apto_credito      boolean DEFAULT false;

-- ── Amenities del edificio/complejo ──────────────────────────────────────
ALTER TABLE propiedades_externas
  ADD COLUMN IF NOT EXISTS com_pileta        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_gimnasio      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_sum           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_ascensor      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_seguridad     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_parrilla      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_quincho       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_solarium      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_laundry       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_cowork        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_juegos_ninos  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_estac_visit   boolean DEFAULT false;

-- ── Ambientes propios ─────────────────────────────────────────────────────
ALTER TABLE propiedades_externas
  ADD COLUMN IF NOT EXISTS amb_balcon        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS amb_terraza       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS amb_jardin        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS amb_patio         boolean DEFAULT false;

-- ── Multimedia extra ──────────────────────────────────────────────────────
ALTER TABLE propiedades_externas
  ADD COLUMN IF NOT EXISTS video_url         text,
  ADD COLUMN IF NOT EXISTS tour_virtual_url  text;

-- ── Agente/corredor que publicó la propiedad ─────────────────────────────
ALTER TABLE propiedades_externas
  ADD COLUMN IF NOT EXISTS agente_nombre     text,
  ADD COLUMN IF NOT EXISTS agente_telefono   text,
  ADD COLUMN IF NOT EXISTS agente_email      text;

-- ── Actualizar v_propiedades_mercado para exponer nuevos campos ───────────
-- (También actualiza la función para que future calls a reparar_vista... queden bien)

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
  ambientes,
  superficie_cubierta,
  sup_terreno,
  sup_semicubierta,
  sup_descubierta,
  expensas,
  orientacion,
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
  amb_balcon,
  amb_terraza,
  amb_jardin,
  amb_patio,
  video_url,
  tour_virtual_url,
  NULL::text                                                    AS agente_nombre,
  NULL::text                                                    AS agente_telefono,
  NULL::text                                                    AS agente_email,
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
  ambientes,
  superficie_cubierta,
  sup_terreno,
  sup_semicubierta,
  sup_descubierta,
  expensas,
  orientacion,
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
  amb_balcon,
  amb_terraza,
  amb_jardin,
  amb_patio,
  video_url,
  tour_virtual_url,
  agente_nombre,
  agente_telefono,
  agente_email,
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

-- ── Actualizar función de reparación para incluir nuevos campos ──────────
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
    dormitorios, banos, ambientes, superficie_cubierta, sup_terreno,
    sup_semicubierta, sup_descubierta, expensas,
    orientacion, piso::text AS piso, estacionamientos AS cocheras,
    bauleras::boolean AS baulera, antiguedad,
    amoblado, acepta_mascotas, apto_credito,
    com_pileta, com_gimnasio, com_sum, com_ascensor, com_seguridad,
    com_parrilla, com_quincho, com_solarium, com_lavanderia AS com_laundry,
    com_cowork, com_juegos_infantiles AS com_juegos_ninos,
    amb_balcon, amb_terraza, amb_jardin, amb_patio,
    video_url, tour_virtual_url,
    NULL::text AS agente_nombre, NULL::text AS agente_telefono, NULL::text AS agente_email,
    (CASE WHEN fotos IS NOT NULL AND array_length(fotos, 1) > 0 THEN fotos[1] ELSE NULL END) AS foto_principal,
    descripcion, '/crm/cartera/ficha/' || id::text AS url,
    perfil_id::text AS propietario_id, estado, updated_at
  FROM cartera_propiedades WHERE estado IN ('activa', 'reservada')
  UNION ALL
  SELECT
    id::text AS id, portal AS fuente, portal AS red, titulo,
    operacion, tipo, precio, moneda, barrio, ciudad, provincia,
    direccion, lat, lng, dormitorios, banos, ambientes,
    superficie_cubierta, sup_terreno, sup_semicubierta, sup_descubierta, expensas,
    orientacion, piso::text AS piso, cocheras, baulera, antiguedad,
    amoblado, acepta_mascotas, apto_credito,
    com_pileta, com_gimnasio, com_sum, com_ascensor, com_seguridad,
    com_parrilla, com_quincho, com_solarium, com_laundry, com_cowork, com_juegos_ninos,
    amb_balcon, amb_terraza, amb_jardin, amb_patio,
    video_url, tour_virtual_url, agente_nombre, agente_telefono, agente_email,
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
