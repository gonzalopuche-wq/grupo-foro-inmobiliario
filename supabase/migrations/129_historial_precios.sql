CREATE TABLE IF NOT EXISTS historial_precios_cartera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id uuid NOT NULL REFERENCES cartera_propiedades(id) ON DELETE CASCADE,
  precio numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'USD',
  tipo text NOT NULL DEFAULT 'actualizacion', -- 'inicial', 'reduccion', 'aumento', 'actualizacion'
  nota text,
  registrado_por uuid REFERENCES perfiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_precios_prop ON historial_precios_cartera(propiedad_id, created_at);

ALTER TABLE historial_precios_cartera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corredor gestiona historial precios" ON historial_precios_cartera
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM cartera_propiedades cp WHERE cp.id = propiedad_id AND cp.perfil_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cartera_propiedades cp WHERE cp.id = propiedad_id AND cp.perfil_id = auth.uid()));
