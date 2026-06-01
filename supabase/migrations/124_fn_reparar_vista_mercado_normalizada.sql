-- Función callable via sb.rpc("reparar_vista_mercado_normalizada")
-- Recrea v_propiedades_mercado con LOWER(operacion) y LOWER(tipo) para cartera GFI
-- (La cartera GFI guarda "Venta"/"Departamento"; los externos ya usan minúsculas)
-- SECURITY DEFINER ejecuta con privilegios del owner

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
    id::text                                                    AS id,
    'gfi'                                                       AS fuente,
    'gfi'                                                       AS red,
    titulo,
    LOWER(operacion)                                            AS operacion,
    LOWER(tipo)                                                 AS tipo,
    precio, moneda,
    zona                                                        AS barrio,
    ciudad,
    'Santa Fe'::text                                            AS provincia,
    direccion,
    latitud                                                     AS lat,
    longitud                                                    AS lng,
    dormitorios, banos,
    NULL::integer                                               AS ambientes,
    superficie_cubierta,
    NULL::numeric                                               AS sup_terreno,
    NULL::numeric                                               AS expensas,
    (CASE WHEN fotos IS NOT NULL AND array_length(fotos, 1) > 0
          THEN fotos[1] ELSE NULL END)                          AS foto_principal,
    descripcion,
    '/crm/cartera/ficha/' || id::text                           AS url,
    perfil_id::text                                             AS propietario_id,
    estado,
    updated_at
  FROM cartera_propiedades
  WHERE estado IN ('activa', 'reservada')

  UNION ALL

  SELECT
    id::text                                                    AS id,
    portal                                                      AS fuente,
    portal                                                      AS red,
    titulo, operacion, tipo, precio, moneda, barrio, ciudad, provincia,
    direccion, lat, lng, dormitorios, banos, ambientes,
    superficie_cubierta,
    NULL::numeric                                               AS sup_terreno,
    NULL::numeric                                               AS expensas,
    (CASE WHEN imagenes IS NOT NULL AND jsonb_array_length(imagenes) > 0
          THEN imagenes ->> 0 ELSE NULL END)                    AS foto_principal,
    descripcion, url,
    NULL::text                                                  AS propietario_id,
    'activa'                                                    AS estado,
    synced_at                                                   AS updated_at
  FROM propiedades_externas
  WHERE activa = true;

  GRANT SELECT ON v_propiedades_mercado TO authenticated;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION reparar_vista_mercado_normalizada() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reparar_vista_mercado_normalizada() TO service_role;

-- También actualizar el constraint para incluir 'gfi' y 'propia' plain
CREATE OR REPLACE FUNCTION reparar_constraint_portales_v2()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE propiedades_externas
    DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;
  ALTER TABLE propiedades_externas
    ADD CONSTRAINT propiedades_externas_portal_check
    CHECK (portal IN (
      'mercadolibre','zonaprop','argenprop','properati',
      'gfi_red','gfi_portal','gfi',
      'kiteprop','tokko',
      'propia','propia_red','propia_portal'
    ));
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION reparar_constraint_portales_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reparar_constraint_portales_v2() TO service_role;
