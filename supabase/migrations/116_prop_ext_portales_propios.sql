-- Ampliar el CHECK constraint para incluir portales propios de GFI
ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;
ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check
  CHECK (portal IN ('mercadolibre','zonaprop','argenprop','properati','gfi_red','gfi_portal'));
