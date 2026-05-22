-- Migration 098: tablas indicadores, indicadores_historial, mir_matches, mir_desbloqueos

-- ── indicadores: valores actuales de índices económicos ──────────────────────

CREATE TABLE IF NOT EXISTS indicadores (
  clave           text PRIMARY KEY,
  valor           numeric,
  valor_texto     text,
  descripcion     text,
  fuente          text,
  actualizado_at  timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE indicadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indicadores_public_select" ON indicadores
  FOR SELECT USING (true);

CREATE POLICY "indicadores_admin_all" ON indicadores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

-- ── indicadores_historial: historial mensual de índices ──────────────────────

CREATE TABLE IF NOT EXISTS indicadores_historial (
  id          bigserial PRIMARY KEY,
  clave       text NOT NULL,
  valor       numeric,
  periodo     text NOT NULL,
  descripcion text,
  fuente      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clave, periodo)
);

ALTER TABLE indicadores_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indicadores_hist_public_select" ON indicadores_historial
  FOR SELECT USING (true);

CREATE POLICY "indicadores_hist_admin_all" ON indicadores_historial
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_ind_hist_clave_periodo ON indicadores_historial(clave, periodo);

-- ── mir_matches: cruce ofrecido↔busqueda en MIR ──────────────────────────────

CREATE TABLE IF NOT EXISTS mir_matches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ofrecido_id           uuid REFERENCES mir_ofrecidos(id) ON DELETE CASCADE,
  busqueda_id           uuid REFERENCES mir_busquedas(id) ON DELETE CASCADE,
  desbloqueado_ofrecido boolean NOT NULL DEFAULT false,
  desbloqueado_busqueda boolean NOT NULL DEFAULT false,
  score                 int DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ofrecido_id, busqueda_id)
);

ALTER TABLE mir_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mir_matches_authenticated_select" ON mir_matches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mir_matches_authenticated_insert" ON mir_matches
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "mir_matches_admin_all" ON mir_matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_mir_matches_ofrecido  ON mir_matches(ofrecido_id);
CREATE INDEX IF NOT EXISTS idx_mir_matches_busqueda  ON mir_matches(busqueda_id);
CREATE INDEX IF NOT EXISTS idx_mir_matches_created   ON mir_matches(created_at DESC);

-- ── mir_desbloqueos: registro de desbloqueos pagos en MIR ───────────────────

CREATE TABLE IF NOT EXISTS mir_desbloqueos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES mir_matches(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  monto       numeric NOT NULL DEFAULT 0,
  tipo        text NOT NULL CHECK (tipo IN ('ofrecido','busqueda')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mir_desbloqueos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mir_desbloqueos_own_select" ON mir_desbloqueos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "mir_desbloqueos_admin_all" ON mir_desbloqueos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_mir_desbloqueos_match  ON mir_desbloqueos(match_id);
CREATE INDEX IF NOT EXISTS idx_mir_desbloqueos_user   ON mir_desbloqueos(user_id);
