create table if not exists suscripcion_beneficios (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null,
  admin_id uuid not null,
  tipo text not null,
  descuento_pct numeric not null default 0,
  monto_fijo_usd numeric not null default 0,
  es_cortesia boolean not null default false,
  fecha_desde date not null default current_date,
  fecha_hasta date,
  activo boolean not null default true,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sb_perfil on suscripcion_beneficios(perfil_id);

alter table suscripcion_beneficios enable row level security;

create policy sb_all on suscripcion_beneficios for all to authenticated using (true) with check (true);
