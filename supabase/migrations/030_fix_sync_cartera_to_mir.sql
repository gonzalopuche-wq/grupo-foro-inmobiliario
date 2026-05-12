-- Corregir sync_cartera_to_mir: normalizar operacion antes de insertar en mir_ofrecidos.
-- cartera_propiedades guarda "Venta"/"Alquiler"/"Alquiler temporal";
-- mir_ofrecidos espera "venta"/"alquiler"/"temporario" (constraint check).

CREATE OR REPLACE FUNCTION public.sync_cartera_to_mir()
  RETURNS trigger
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_operacion text;
BEGIN
  IF NEW.estado IN ('activa', 'disponible') OR NEW.estado IS NULL THEN
    v_operacion := CASE NEW.operacion
      WHEN 'Venta'             THEN 'venta'
      WHEN 'Alquiler'          THEN 'alquiler'
      WHEN 'Alquiler temporal' THEN 'temporario'
      ELSE LOWER(REPLACE(NEW.operacion, ' ', '_'))
    END;

    INSERT INTO mir_ofrecidos (
      perfil_id, cartera_id, operacion, tipo_propiedad,
      zona, ciudad, precio, moneda,
      dormitorios, banos, superficie_cubierta, superficie_total,
      descripcion, apto_credito, con_cochera, activo, created_at
    ) VALUES (
      NEW.perfil_id, NEW.id, v_operacion, NEW.tipo,
      NEW.zona, COALESCE(NEW.ciudad, 'Rosario'), NEW.precio, COALESCE(NEW.moneda, 'USD'),
      NEW.dormitorios, NEW.banos, NEW.superficie_cubierta, NEW.superficie_total,
      NEW.descripcion, COALESCE(NEW.apto_credito, false), COALESCE(NEW.con_cochera, false),
      true, now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
