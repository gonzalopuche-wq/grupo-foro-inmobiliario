-- Migration 064: eventos_agenda — agenda personal del corredor
-- Existía en producción sin migration script; documentada para reproducibilidad.

CREATE TABLE IF NOT EXISTS eventos_agenda (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  fecha       date NOT NULL,
  hora        text,
  hora_fin    text,
  tipo        text NOT NULL DEFAULT 'cita'
                CHECK (tipo IN ('cita','llamada','visita','reunion','recordatorio','otro')),
  descripcion text,
  lugar       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eventos_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_agenda_own_select" ON eventos_agenda FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "eventos_agenda_own_insert" ON eventos_agenda FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "eventos_agenda_own_update" ON eventos_agenda FOR UPDATE USING (auth.uid() = usuario_id);
CREATE POLICY "eventos_agenda_own_delete" ON eventos_agenda FOR DELETE USING (auth.uid() = usuario_id);
CREATE POLICY "eventos_agenda_admin_all"  ON eventos_agenda FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_eventos_agenda_usuario ON eventos_agenda(usuario_id);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_fecha   ON eventos_agenda(fecha);
