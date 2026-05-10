-- ─────────────────────────────────────────────────────────────────────────────
-- 014 · Encuestas de mercado + Denuncias/Moderación
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Encuestas de mercado ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encuestas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id  UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  descripcion TEXT,
  opciones    JSONB NOT NULL DEFAULT '[]',   -- [{ id, texto }]
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_cierre DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE encuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encuestas_read_all" ON encuestas;
CREATE POLICY "encuestas_read_all" ON encuestas FOR SELECT USING (true);
DROP POLICY IF EXISTS "encuestas_write_owner" ON encuestas;
CREATE POLICY "encuestas_write_owner" ON encuestas FOR ALL USING (creador_id = auth.uid());

CREATE TABLE IF NOT EXISTS encuesta_votos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id UUID NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  perfil_id   UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  opcion_id   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(encuesta_id, perfil_id)
);

ALTER TABLE encuesta_votos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encuesta_votos_read" ON encuesta_votos;
CREATE POLICY "encuesta_votos_read" ON encuesta_votos FOR SELECT USING (true);
DROP POLICY IF EXISTS "encuesta_votos_insert" ON encuesta_votos;
CREATE POLICY "encuesta_votos_insert" ON encuesta_votos FOR INSERT WITH CHECK (perfil_id = auth.uid());

-- ── 2. Denuncias y Moderación ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS denuncias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denunciante_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo_contenido TEXT NOT NULL,   -- forum_topic | forum_message | perfil
  contenido_id  TEXT NOT NULL,
  motivo        TEXT NOT NULL,    -- spam | ofensivo | incorrecto | acoso | otro
  descripcion   TEXT,
  estado        TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | revisado | resuelto | rechazado
  revisado_por  UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "denuncias_insert" ON denuncias;
CREATE POLICY "denuncias_insert" ON denuncias FOR INSERT WITH CHECK (denunciante_id = auth.uid());
DROP POLICY IF EXISTS "denuncias_read_own" ON denuncias;
CREATE POLICY "denuncias_read_own" ON denuncias FOR SELECT USING (denunciante_id = auth.uid());
DROP POLICY IF EXISTS "denuncias_admin_all" ON denuncias;
CREATE POLICY "denuncias_admin_all" ON denuncias FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));
