-- Beneficio exclusivo que cada sponsor ofrece a corredores registrados GFI
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS beneficio text;
