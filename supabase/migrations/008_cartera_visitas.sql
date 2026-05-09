-- ── Órdenes de Visita ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cartera_visitas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id        uuid REFERENCES perfiles(id) ON DELETE CASCADE,
  propiedad_id     uuid REFERENCES cartera_propiedades(id) ON DELETE SET NULL,
  numero_orden     text,

  -- Datos del cliente
  cliente_nombre   text NOT NULL,
  cliente_dni      text,
  cliente_telefono text,
  cliente_email    text,

  -- Visita
  fecha_visita     timestamptz,
  estado           text NOT NULL DEFAULT 'pendiente', -- pendiente | realizada | cancelada
  observaciones    text,

  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE cartera_visitas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cartera_visitas' AND policyname = 'corredor_sus_visitas'
  ) THEN
    CREATE POLICY "corredor_sus_visitas"
      ON cartera_visitas FOR ALL
      USING (auth.uid() = perfil_id);
  END IF;
END $$;

-- Auto-numbering trigger for numero_orden
CREATE OR REPLACE FUNCTION set_numero_orden()
RETURNS TRIGGER AS $$
DECLARE
  anio text;
  cnt  int;
BEGIN
  IF NEW.numero_orden IS NULL OR NEW.numero_orden = '' THEN
    anio := to_char(now(), 'YYYY');
    SELECT COUNT(*) + 1 INTO cnt
      FROM cartera_visitas
      WHERE perfil_id = NEW.perfil_id
        AND to_char(created_at, 'YYYY') = anio;
    NEW.numero_orden := 'V-' || anio || '-' || LPAD(cnt::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_numero_orden ON cartera_visitas;
CREATE TRIGGER trg_numero_orden
  BEFORE INSERT ON cartera_visitas
  FOR EACH ROW EXECUTE FUNCTION set_numero_orden();
