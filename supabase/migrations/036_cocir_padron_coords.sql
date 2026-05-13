alter table cocir_padron add column if not exists latitud numeric;
alter table cocir_padron add column if not exists longitud numeric;
alter table cocir_padron add column if not exists geocodificado_at timestamptz;

create index if not exists idx_cp_coords on cocir_padron(latitud, longitud) where latitud is not null;
