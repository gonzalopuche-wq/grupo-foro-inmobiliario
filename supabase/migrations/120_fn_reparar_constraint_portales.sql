-- Función que el app puede llamar via rpc() para reparar el constraint
-- SECURITY DEFINER ejecuta con privilegios del owner (postgres/supabase_admin)
CREATE OR REPLACE FUNCTION reparar_constraint_portales()
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
      'gfi_red','gfi_portal',
      'kiteprop','tokko',
      'propia_red','propia_portal'
    ));
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

-- Solo admins de Supabase pueden ejecutarla (no anon, no authenticated directo)
REVOKE ALL ON FUNCTION reparar_constraint_portales() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reparar_constraint_portales() TO service_role;
