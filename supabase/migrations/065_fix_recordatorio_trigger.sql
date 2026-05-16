-- Migration 065: corrige el trigger sync_recordatorio_completado
-- El trigger anterior solo respondía a UPDATE y tenía lógica ELSIF que
-- no cubría estado='cancelado'. Esta versión reemplaza la función y el
-- trigger con la lógica correcta bidireccional.

CREATE OR REPLACE FUNCTION sync_recordatorio_completado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- On INSERT, or when estado changed: estado is authoritative → sync completado
  IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.completado = (NEW.estado = 'completado');
  -- When only completado changed: completado is authoritative → sync estado
  ELSIF NEW.completado IS DISTINCT FROM OLD.completado THEN
    NEW.estado = CASE WHEN NEW.completado THEN 'completado' ELSE 'pendiente' END;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_rec_completado ON crm_recordatorios;
CREATE TRIGGER trg_crm_rec_completado
  BEFORE INSERT OR UPDATE ON crm_recordatorios
  FOR EACH ROW EXECUTE FUNCTION sync_recordatorio_completado();
