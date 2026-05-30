-- Migración de reparación: asegura que propiedades_externas admita TODOS los portales
-- Necesaria si las migraciones 116-118 no se aplicaron en orden
ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;
ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check
  CHECK (portal IN (
    'mercadolibre','zonaprop','argenprop','properati',
    'gfi_red','gfi_portal',
    'kiteprop','tokko',
    'propia_red','propia_portal'
  ));
