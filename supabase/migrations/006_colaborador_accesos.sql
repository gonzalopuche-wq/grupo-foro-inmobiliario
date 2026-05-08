-- ═══════════════════════════════════════════════════════════════════════════
-- GFI® — Accesos extendidos para colaboradores
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Sector del colaborador (alquileres | ventas | temporarios | permutas | campos | todos)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'colaboradores' AND column_name = 'sector'
  ) THEN
    ALTER TABLE colaboradores ADD COLUMN sector text NOT NULL DEFAULT 'todos';
  END IF;
END $$;

-- 2. Etiquetas de sector en grupos_chat (array vacío = visible a todos los colaboradores)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grupos_chat' AND column_name = 'sectores'
  ) THEN
    ALTER TABLE grupos_chat ADD COLUMN sectores text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- 3. RLS: colaborador puede leer su propio registro para obtener corredor_id y sector
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'colaboradores' AND policyname = 'colaborador_ve_su_propio_registro'
  ) THEN
    CREATE POLICY "colaborador_ve_su_propio_registro"
      ON colaboradores FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 4. RLS: colaborador puede leer la cartera de su corredor
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cartera_propiedades' AND policyname = 'colaborador_lee_cartera_corredor'
  ) THEN
    CREATE POLICY "colaborador_lee_cartera_corredor"
      ON cartera_propiedades FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM colaboradores c
          WHERE c.user_id = auth.uid()
            AND c.corredor_id = cartera_propiedades.perfil_id
            AND c.estado = 'activo'
        )
      );
  END IF;
END $$;

-- 5. RLS: colaborador puede insertar/actualizar/eliminar en la cartera de su corredor
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cartera_propiedades' AND policyname = 'colaborador_escribe_cartera_corredor'
  ) THEN
    CREATE POLICY "colaborador_escribe_cartera_corredor"
      ON cartera_propiedades FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM colaboradores c
          WHERE c.user_id = auth.uid()
            AND c.corredor_id = cartera_propiedades.perfil_id
            AND c.estado = 'activo'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM colaboradores c
          WHERE c.user_id = auth.uid()
            AND c.corredor_id = cartera_propiedades.perfil_id
            AND c.estado = 'activo'
        )
      );
  END IF;
END $$;

-- 6. Renombrar grupo "Inmuebles Comerciales" → "Inmuebles Comerciales e Industriales"
UPDATE grupos_chat
  SET nombre = 'Inmuebles Comerciales e Industriales'
  WHERE nombre ILIKE '%inmuebles comerciales%'
    AND nombre NOT ILIKE '%industriales%';

-- 7. RLS: colaborador puede leer/escribir sync de portales de la cartera de su corredor
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cartera_sync_portales' AND policyname = 'colaborador_sync_portales_corredor'
  ) THEN
    CREATE POLICY "colaborador_sync_portales_corredor"
      ON cartera_sync_portales FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM cartera_propiedades cp
          JOIN colaboradores c ON c.corredor_id = cp.perfil_id
          WHERE cp.id = cartera_sync_portales.propiedad_id
            AND c.user_id = auth.uid()
            AND c.estado = 'activo'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM cartera_propiedades cp
          JOIN colaboradores c ON c.corredor_id = cp.perfil_id
          WHERE cp.id = cartera_sync_portales.propiedad_id
            AND c.user_id = auth.uid()
            AND c.estado = 'activo'
        )
      );
  END IF;
END $$;
