-- MOD 91: Recorridas Virtuales 360° — agrega URL de tour virtual a cartera_propiedades
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS tour_virtual_url text;
