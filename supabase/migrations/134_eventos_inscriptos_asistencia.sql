-- Migración 134: Gestión de inscriptos a eventos
-- ─────────────────────────────────────────────────────────────────────────────
-- Agrega asistencia (asistio) y permite que el ORGANIZADOR del evento (o un
-- admin/master) gestione las inscripciones de SU evento: ver la lista, marcar
-- quién asistió, y agregar/quitar gente (ej. inscriptos de último momento).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE inscripciones_eventos ADD COLUMN IF NOT EXISTS asistio boolean NOT NULL DEFAULT false;
ALTER TABLE inscripciones_eventos ADD COLUMN IF NOT EXISTS asistio_at timestamptz;
-- Quién cargó la inscripción (null = se inscribió la persona sola).
ALTER TABLE inscripciones_eventos ADD COLUMN IF NOT EXISTS agregado_por uuid REFERENCES perfiles(id) ON DELETE SET NULL;
-- Pago del inscripto: pago = acreditado (casilla), monto_pagado = lo transferido.
ALTER TABLE inscripciones_eventos ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false;
ALTER TABLE inscripciones_eventos ADD COLUMN IF NOT EXISTS monto_pagado numeric(14,2);

-- Finanzas del evento: gasto cargado + flag para no pasar dos veces al saldo general.
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS gasto numeric(14,2);
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS finanzas_pasadas boolean NOT NULL DEFAULT false;

-- El organizador del evento (o admin/master) puede ver y gestionar TODAS las
-- inscripciones de su evento (las policies existentes "own_all" y "public_select"
-- siguen; ésta agrega los permisos del organizador).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inscripciones_eventos' AND policyname = 'inscripciones_organizador_all'
  ) THEN
    CREATE POLICY inscripciones_organizador_all ON inscripciones_eventos
      FOR ALL
      USING (
        EXISTS (SELECT 1 FROM eventos e WHERE e.id = evento_id AND e.organizador_id = auth.uid())
        OR EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.tipo IN ('admin', 'master'))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM eventos e WHERE e.id = evento_id AND e.organizador_id = auth.uid())
        OR EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.tipo IN ('admin', 'master'))
      );
  END IF;
END $$;
