-- Asegura que propiedades_externas acepte todos los portales actuales del sistema.
-- Idempotente: puede correrse aunque la 119 ya esté aplicada.
ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;

ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check
  CHECK (portal IN (
    'mercadolibre', 'zonaprop', 'argenprop', 'properati',
    'gfi_red', 'gfi_portal', 'gfi',
    'kiteprop',
    'tokko',
    'propia', 'propia_red', 'propia_portal'
  ));
