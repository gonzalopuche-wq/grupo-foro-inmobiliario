-- Migration 063: crm_recordatorios — tabla de recordatorios del CRM
-- Existía en producción sin migration script; documentada para reproducibilidad.

CREATE TABLE IF NOT EXISTS crm_recordatorios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contacto_id         uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,
  negocio_id          uuid REFERENCES crm_negocios(id) ON DELETE SET NULL,
  titulo              text,
  descripcion         text NOT NULL DEFAULT '',
  notas               text,
  fecha_recordatorio  timestamptz NOT NULL,
  estado              text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','completado','cancelado')),
  completado          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_rec_own_select" ON crm_recordatorios FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "crm_rec_own_insert" ON crm_recordatorios FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "crm_rec_own_update" ON crm_recordatorios FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_rec_own_delete" ON crm_recordatorios FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "crm_rec_admin_all"  ON crm_recordatorios FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_crm_rec_perfil  ON crm_recordatorios(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_rec_fecha   ON crm_recordatorios(fecha_recordatorio);
CREATE INDEX IF NOT EXISTS idx_crm_rec_estado  ON crm_recordatorios(estado);
CREATE INDEX IF NOT EXISTS idx_crm_rec_contacto ON crm_recordatorios(contacto_id);

-- Trigger para mantener completado sincronizado con estado
CREATE OR REPLACE FUNCTION sync_recordatorio_completado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'completado' THEN
    NEW.completado = true;
  ELSIF NEW.estado = 'pendiente' THEN
    NEW.completado = false;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_rec_completado ON crm_recordatorios;
CREATE TRIGGER trg_crm_rec_completado
  BEFORE UPDATE ON crm_recordatorios
  FOR EACH ROW EXECUTE FUNCTION sync_recordatorio_completado();
