-- Políticas RLS para que el corredor acceda a sus propias propiedades en cartera
-- (la tabla fue creada sin políticas para el owner; solo existían las de colaborador)

ALTER TABLE cartera_propiedades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cartera_propiedades' AND policyname = 'corredor_su_cartera'
  ) THEN
    CREATE POLICY "corredor_su_cartera"
      ON cartera_propiedades FOR ALL
      USING (auth.uid() = perfil_id)
      WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

-- Admin puede ver y editar todas las propiedades
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cartera_propiedades' AND policyname = 'admin_cartera_all'
  ) THEN
    CREATE POLICY "admin_cartera_all"
      ON cartera_propiedades FOR ALL
      USING (
        EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
      );
  END IF;
END $$;
