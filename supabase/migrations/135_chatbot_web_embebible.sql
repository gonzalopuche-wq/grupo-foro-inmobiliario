-- Migración 135: Chatbot Web Embebible
-- ─────────────────────────────────────────────────────────────────────────────
-- Configuración del chatbot que el corredor puede embeber en cualquier web
-- (un <script> que muestra una burbuja de chat con IA que lee sus propiedades
-- publicadas y capta leads). Todo vive en web_corredor_config (1 fila por
-- corredor), así reusa el slug y las policies ya existentes.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE web_corredor_config
  ADD COLUMN IF NOT EXISTS chatbot_activo          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatbot_color           text    NOT NULL DEFAULT '#6366F1',
  ADD COLUMN IF NOT EXISTS chatbot_bienvenida      text,
  -- Posición de la burbuja: 'br' = abajo derecha, 'bl' = abajo izquierda.
  ADD COLUMN IF NOT EXISTS chatbot_posicion        text    NOT NULL DEFAULT 'br',
  -- Si está activo, al entrar un lead por el chatbot se notifica al corredor por WhatsApp.
  ADD COLUMN IF NOT EXISTS chatbot_notif_whatsapp  boolean NOT NULL DEFAULT false;

-- La policy "wcc_public_read" (activa = true) ya permite leer la config del
-- chatbot de forma pública; el endpoint del widget igual usa service role.
