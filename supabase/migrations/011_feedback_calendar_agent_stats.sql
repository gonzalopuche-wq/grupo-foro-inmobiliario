-- ── Feedback post-visita ─────────────────────────────────────────────────────
ALTER TABLE cartera_visitas
  ADD COLUMN IF NOT EXISTS feedback_puntaje    int,          -- 1-5 estrellas
  ADD COLUMN IF NOT EXISTS feedback_interes    text,         -- 'si' | 'no' | 'tal_vez'
  ADD COLUMN IF NOT EXISTS feedback_comentario text,
  ADD COLUMN IF NOT EXISTS feedback_at         timestamptz;

-- ── Google Calendar OAuth per user ───────────────────────────────────────────
ALTER TABLE portal_credenciales
  ADD COLUMN IF NOT EXISTS google_access_token     text,
  ADD COLUMN IF NOT EXISTS google_refresh_token    text,
  ADD COLUMN IF NOT EXISTS google_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_id      text;

-- ── Estadísticas por agente: quién creó el lead / la visita ─────────────────
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE cartera_visitas
  ADD COLUMN IF NOT EXISTS created_by uuid;
