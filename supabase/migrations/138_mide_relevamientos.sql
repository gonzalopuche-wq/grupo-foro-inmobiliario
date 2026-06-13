-- Migración 138: Relevamientos de la app GFI MIDE (medición de ambientes / plano / 3D)
-- ─────────────────────────────────────────────────────────────────────────────
-- La app móvil "GFI MIDE" (proyecto Expo independiente, package com.gfi.mide)
-- permite al corredor relevar una propiedad: medir ambientes con la cámara,
-- armar el plano 2D, ver el recorrido 3D y generar la descripción con IA.
--
-- Cada relevamiento guarda sus ambientes y fotos como JSONB (estructura flexible
-- que evoluciona del lado de la app sin migraciones nuevas por cada campo).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mide_relevamientos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo          text NOT NULL DEFAULT 'Relevamiento sin título',
  direccion       text,
  tipo            text,           -- departamento, casa, ph, local, etc.
  operacion       text,           -- venta, alquiler
  alto_techo      numeric,        -- altura de techo en metros (default por ambiente)
  ambientes       jsonb NOT NULL DEFAULT '[]'::jsonb,
                  -- [{ id, nombre, largo, ancho, alto, area, foto_url }]
  superficie_total numeric,
  plano_data      jsonb,          -- layout calculado del plano 2D (cache opcional)
  descripcion_ia  text,
  tono            text DEFAULT 'profesional',
  cartera_id      uuid,           -- si se exportó a cartera_propiedades
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mide_relevamientos_perfil ON mide_relevamientos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_mide_relevamientos_creado ON mide_relevamientos(created_at DESC);

ALTER TABLE mide_relevamientos ENABLE ROW LEVEL SECURITY;

-- Cada corredor solo ve y edita sus propios relevamientos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mide_relevamientos' AND policyname = 'mide_relevamientos_own'
  ) THEN
    CREATE POLICY mide_relevamientos_own ON mide_relevamientos
      FOR ALL USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
  END IF;
END $$;

-- Mantener updated_at al día.
CREATE OR REPLACE FUNCTION mide_relevamientos_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mide_relevamientos_touch ON mide_relevamientos;
CREATE TRIGGER trg_mide_relevamientos_touch
  BEFORE UPDATE ON mide_relevamientos
  FOR EACH ROW EXECUTE FUNCTION mide_relevamientos_touch();
