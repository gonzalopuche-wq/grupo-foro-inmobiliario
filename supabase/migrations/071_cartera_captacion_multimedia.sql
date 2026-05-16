-- Migration 071: campos de captación, multimedia extendido y links de portales
-- en cartera_propiedades

ALTER TABLE cartera_propiedades
  -- Captación
  ADD COLUMN IF NOT EXISTS fecha_captacion          date,
  ADD COLUMN IF NOT EXISTS origen_propietario       text,
  ADD COLUMN IF NOT EXISTS fecha_sesion_fotos       date,
  ADD COLUMN IF NOT EXISTS fecha_inicio_exclusividad date,
  ADD COLUMN IF NOT EXISTS fecha_fin_exclusividad   date,
  ADD COLUMN IF NOT EXISTS usa_home_staging         boolean NOT NULL DEFAULT false,
  -- Videos adicionales
  ADD COLUMN IF NOT EXISTS video_url_2              text,
  ADD COLUMN IF NOT EXISTS video_url_3              text,
  -- Links de portales donde está publicada
  ADD COLUMN IF NOT EXISTS link_zonaprop            text,
  ADD COLUMN IF NOT EXISTS link_argenprop           text,
  ADD COLUMN IF NOT EXISTS link_mercadolibre        text,
  ADD COLUMN IF NOT EXISTS link_tokko               text;
