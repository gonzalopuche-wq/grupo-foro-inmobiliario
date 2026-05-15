-- Expansión del sistema de roles GFI
-- Nuevos tipos: master (super-admin/dueño), proveedor
-- Nuevo campo: rubro (para corredores y colaboradores: alquiler/venta/ambos)

-- 1. Columna rubro en perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS rubro text;
CREATE INDEX IF NOT EXISTS idx_perfiles_rubro ON perfiles(rubro);

-- 2. Función helper para chequeo admin/master en RLS
CREATE OR REPLACE FUNCTION es_admin_gfi() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS
$$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin', 'master')
  );
$$;

-- 3. Actualizar políticas de admin_socios y admin_retiros para incluir master
DROP POLICY IF EXISTS "socios_admin_all" ON admin_socios;
CREATE POLICY "socios_admin_all" ON admin_socios FOR ALL USING (es_admin_gfi());

DROP POLICY IF EXISTS "retiros_admin_all" ON admin_retiros;
CREATE POLICY "retiros_admin_all" ON admin_retiros FOR ALL USING (es_admin_gfi());

-- 4. Actualizar políticas de finanzas
DROP POLICY IF EXISTS "admin_can_all_finanzas" ON admin_finanzas;
CREATE POLICY "admin_can_all_finanzas" ON admin_finanzas FOR ALL USING (es_admin_gfi());

-- 5. Actualizar políticas de logs_actividad (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'logs_actividad') THEN
    EXECUTE 'DROP POLICY IF EXISTS "logs_admin_all" ON logs_actividad';
    EXECUTE 'CREATE POLICY "logs_admin_all" ON logs_actividad FOR ALL USING (es_admin_gfi())';
  END IF;
END$$;

-- 6. Indicadores GFI (admin_indicadores si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_indicadores') THEN
    EXECUTE 'DROP POLICY IF EXISTS "indicadores_admin_all" ON admin_indicadores';
    EXECUTE 'CREATE POLICY "indicadores_admin_all" ON admin_indicadores FOR ALL USING (es_admin_gfi())';
  END IF;
END$$;
