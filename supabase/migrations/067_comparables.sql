-- Migration 067: comparables — tabla de operaciones comparables para tasación
-- Existía en producción sin migration script; documentada para reproducibilidad.
-- Nota: usa creado_at / actualizado_at (no created_at / updated_at).

CREATE TABLE IF NOT EXISTS comparables (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio                integer NOT NULL,
  mes                 integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  calle               text NOT NULL,
  altura              text,
  barrio              text,
  ciudad              text NOT NULL DEFAULT 'Rosario',
  tipo_inmueble       text NOT NULL,
  dormitorios         integer,
  banos               integer,
  antiguedad          integer,
  sup_cubierta        numeric(10,2),
  sup_terreno         numeric(10,2),
  disposicion         text,
  balcon              boolean NOT NULL DEFAULT false,
  patio               boolean NOT NULL DEFAULT false,
  amenities           text,
  precio_publicacion  numeric(14,2),
  precio_venta        numeric(14,2),
  propuesta_pago      text,
  cotizacion_dolar    numeric(10,2),
  notas               text,
  creado_at           timestamptz NOT NULL DEFAULT now(),
  actualizado_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comparables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comparables_own_select" ON comparables FOR SELECT USING (auth.uid() = perfil_id);
CREATE POLICY "comparables_own_insert" ON comparables FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "comparables_own_update" ON comparables FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "comparables_own_delete" ON comparables FOR DELETE USING (auth.uid() = perfil_id);
CREATE POLICY "comparables_admin_all"  ON comparables FOR ALL USING (es_admin_gfi());

CREATE INDEX IF NOT EXISTS idx_comparables_perfil ON comparables(perfil_id);
CREATE INDEX IF NOT EXISTS idx_comparables_barrio  ON comparables(barrio);
CREATE INDEX IF NOT EXISTS idx_comparables_anio    ON comparables(anio DESC, mes DESC);
