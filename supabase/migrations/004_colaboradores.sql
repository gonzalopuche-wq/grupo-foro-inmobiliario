-- Tabla para gestionar colaboradores de corredores
-- Creada para vincular colaboradores a sus corredores titulares
-- user_id se popula cuando el colaborador se registra en auth

CREATE TABLE IF NOT EXISTS colaboradores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  corredor_id uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  apellido text NOT NULL,
  email text NOT NULL,
  telefono text,
  dni text,
  rol text NOT NULL DEFAULT 'colaborador' CHECK (rol IN ('colaborador', 'asistente', 'socio')),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activo', 'suspendido')),
  notas text,
  activado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Agregar columna user_id si ya existe la tabla sin ella
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'colaboradores' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE colaboradores ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar columna padron_vacio en perfiles si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'perfiles' AND column_name = 'padron_vacio'
  ) THEN
    ALTER TABLE perfiles ADD COLUMN padron_vacio boolean DEFAULT false;
  END IF;
END $$;

-- RLS básico para colaboradores
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'colaboradores' AND policyname = 'corredor_ve_sus_colaboradores'
  ) THEN
    EXECUTE 'CREATE POLICY "corredor_ve_sus_colaboradores" ON colaboradores FOR SELECT USING (corredor_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'colaboradores' AND policyname = 'corredor_inserta_colaboradores'
  ) THEN
    EXECUTE 'CREATE POLICY "corredor_inserta_colaboradores" ON colaboradores FOR INSERT WITH CHECK (corredor_id = auth.uid())';
  END IF;
END $$;
