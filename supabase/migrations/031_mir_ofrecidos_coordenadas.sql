-- Agregar coordenadas geográficas a mir_ofrecidos para búsqueda en mapa
ALTER TABLE mir_ofrecidos
  ADD COLUMN IF NOT EXISTS latitud  numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitud numeric(10,7);

-- Actualizar sync_cartera_to_mir para propagar latitud/longitud desde cartera
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
      descripcion, apto_credito, con_cochera, activo, created_at,
      latitud, longitud
    ) VALUES (
      NEW.perfil_id, NEW.id, v_operacion, NEW.tipo,
      NEW.zona, COALESCE(NEW.ciudad, 'Rosario'), NEW.precio, COALESCE(NEW.moneda, 'USD'),
      NEW.dormitorios, NEW.banos, NEW.superficie_cubierta, NEW.superficie_total,
      NEW.descripcion, COALESCE(NEW.apto_credito, false), COALESCE(NEW.con_cochera, false),
      true, now(),
      NEW.latitud, NEW.longitud
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
