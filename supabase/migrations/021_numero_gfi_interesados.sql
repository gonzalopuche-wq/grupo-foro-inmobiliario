-- Número GFI secuencial para cada corredor (GFI-001, GFI-042, etc.)
CREATE SEQUENCE IF NOT EXISTS seq_numero_gfi START WITH 1 INCREMENT BY 1;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS numero_gfi integer;

-- Asignar número a usuarios existentes ordenados por fecha de alta
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM perfiles WHERE numero_gfi IS NULL ORDER BY created_at ASC LOOP
    UPDATE perfiles SET numero_gfi = nextval('seq_numero_gfi') WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE perfiles ALTER COLUMN numero_gfi SET DEFAULT nextval('seq_numero_gfi');
CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_numero_gfi ON perfiles(numero_gfi);

-- Tabla de interesados en beneficios de sponsors
CREATE TABLE IF NOT EXISTS sponsor_beneficio_interesados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL REFERENCES red_proveedores(id) ON DELETE CASCADE,
  perfil_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proveedor_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_sbi_proveedor ON sponsor_beneficio_interesados(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_sbi_perfil    ON sponsor_beneficio_interesados(perfil_id);

-- Solo el propio usuario puede insertar/eliminar su interés; admin puede leer todo
ALTER TABLE sponsor_beneficio_interesados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corredor puede gestionar su propio interes"
  ON sponsor_beneficio_interesados
  FOR ALL
  USING (auth.uid() = perfil_id)
  WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "admin puede leer todos los intereses"
  ON sponsor_beneficio_interesados
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));
