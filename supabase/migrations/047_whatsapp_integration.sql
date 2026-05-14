-- WhatsApp Business API Integration
-- MOD 2 (Smart Prospecting), MOD 3 (parser desde WA), MOD 5 (Chat+WA sync)
SET search_path TO public;

-- ── Catálogo de grupos de WhatsApp del Foro ───────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_grupos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  grupo_gfi   text NOT NULL,          -- slug para el parser ('ventas-ofrecidos', etc.)
  descripcion text,
  wa_link     text,                   -- link de invitación al grupo WA
  miembros    int  NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grupo_gfi)
);

-- ── Log de mensajes recibidos vía webhook WhatsApp Business API ───────────────
CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id text UNIQUE NOT NULL,
  numero_from   text NOT NULL,
  nombre_from   text,
  perfil_id     uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  contenido     text NOT NULL,
  grupo_gfi     text,
  procesado     boolean NOT NULL DEFAULT false,
  mir_entry_id  uuid,
  mir_tabla     text CHECK (mir_tabla IN ('mir_ofrecidos','mir_busquedas')),
  error_detalle text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Fuente de origen en tablas MIR ───────────────────────────────────────────
ALTER TABLE mir_ofrecidos
  ADD COLUMN IF NOT EXISTS fuente text NOT NULL DEFAULT 'manual'
  CHECK (fuente IN ('manual','whatsapp','cartera'));

ALTER TABLE mir_busquedas
  ADD COLUMN IF NOT EXISTS fuente text NOT NULL DEFAULT 'manual'
  CHECK (fuente IN ('manual','whatsapp'));

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_mensajes_perfil    ON whatsapp_mensajes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_wa_mensajes_procesado ON whatsapp_mensajes(procesado) WHERE NOT procesado;
CREATE INDEX IF NOT EXISTS idx_wa_mensajes_created   ON whatsapp_mensajes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_grupos_gfi         ON whatsapp_grupos(grupo_gfi);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_grupos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_grupos_select" ON whatsapp_grupos;
CREATE POLICY "wa_grupos_select" ON whatsapp_grupos FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "wa_grupos_admin" ON whatsapp_grupos;
CREATE POLICY "wa_grupos_admin" ON whatsapp_grupos FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

DROP POLICY IF EXISTS "wa_mensajes_admin" ON whatsapp_mensajes;
CREATE POLICY "wa_mensajes_admin" ON whatsapp_mensajes FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

DROP POLICY IF EXISTS "wa_mensajes_own" ON whatsapp_mensajes;
CREATE POLICY "wa_mensajes_own" ON whatsapp_mensajes FOR SELECT
  USING (perfil_id = auth.uid());

-- ── Seed de grupos iniciales ──────────────────────────────────────────────────
INSERT INTO whatsapp_grupos (nombre, grupo_gfi, descripcion, miembros) VALUES
  ('Ventas — Búsquedas',             'ventas-busqueda',        'Corredores buscando propiedades para clientes compradores', 0),
  ('Ventas — Ofrecidos',             'ventas-ofrecidos',       'Propiedades en venta publicadas por corredores', 0),
  ('Alquileres — Búsq. y Ofrecidos', 'alquileres-ofrecidos',   'Alquileres y búsquedas de alquiler', 0),
  ('Alquileres Temporarios',         'alquileres-temporarios', 'Alquileres temporarios disponibles', 0),
  ('Inmuebles Comerciales',          'inmuebles-comerciales',  'Locales, oficinas y fondos de comercio', 0),
  ('Permutas',                       'permutas',               'Propiedades en permuta', 0),
  ('Foro Inmobiliario — Principal',  'general',                'Grupo principal del Foro Inmobiliario Rosario', 1025)
ON CONFLICT (grupo_gfi) DO NOTHING;
