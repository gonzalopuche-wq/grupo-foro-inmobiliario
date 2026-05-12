-- Crear bucket fotos_cartera (público) si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos_cartera',
  'fotos_cartera',
  true,
  10485760,  -- 10 MB por archivo
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política: usuarios autenticados pueden subir sus propias fotos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'fotos_cartera_insert'
  ) THEN
    CREATE POLICY fotos_cartera_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'fotos_cartera');
  END IF;
END $$;

-- Política: lectura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'fotos_cartera_select'
  ) THEN
    CREATE POLICY fotos_cartera_select ON storage.objects
      FOR SELECT USING (bucket_id = 'fotos_cartera');
  END IF;
END $$;

-- Política: usuarios autenticados pueden borrar sus propias fotos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'fotos_cartera_delete'
  ) THEN
    CREATE POLICY fotos_cartera_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'fotos_cartera' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
