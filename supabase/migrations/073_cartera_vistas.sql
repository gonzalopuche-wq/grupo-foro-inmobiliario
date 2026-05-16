-- Track public page view counts per property
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS vistas integer NOT NULL DEFAULT 0;

-- Atomic increment to avoid race conditions
CREATE OR REPLACE FUNCTION incrementar_vistas(prop_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE cartera_propiedades
  SET vistas = vistas + 1
  WHERE id = prop_id;
$$;
