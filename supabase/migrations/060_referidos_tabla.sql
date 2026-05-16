-- Tabla de referidos por corredor
-- Corredores registran personas que recomendaron; admin activa recompensa

CREATE TABLE IF NOT EXISTS referidos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referidor_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  referido_nombre     text NOT NULL,
  referido_email      text,
  referido_telefono   text,
  tipo                text NOT NULL DEFAULT 'corredor'
                        CHECK (tipo IN ('corredor', 'cliente', 'proveedor')),
  estado              text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'activo', 'inactivo')),
  recompensa_aplicada boolean NOT NULL DEFAULT false,
  nota_admin          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE referidos ENABLE ROW LEVEL SECURITY;

-- Corredores ven sus propios referidos
CREATE POLICY "referidos_own_select"
  ON referidos FOR SELECT
  USING (auth.uid() = referidor_id);

CREATE POLICY "referidos_own_insert"
  ON referidos FOR INSERT
  WITH CHECK (auth.uid() = referidor_id);

-- Admin ve y gestiona todos
CREATE POLICY "referidos_admin_all"
  ON referidos FOR ALL
  USING (es_admin_gfi());

-- Índice para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_referidos_referidor ON referidos(referidor_id);
CREATE INDEX IF NOT EXISTS idx_referidos_estado ON referidos(estado);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_referidos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referidos_updated_at ON referidos;
CREATE TRIGGER trg_referidos_updated_at
  BEFORE UPDATE ON referidos
  FOR EACH ROW EXECUTE FUNCTION update_referidos_updated_at();
