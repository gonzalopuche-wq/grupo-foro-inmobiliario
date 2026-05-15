-- Migration 050: MOD 85/86 — Integración CRMs externos y sistemas de administración

create table if not exists crm_integraciones_config (
  id                    uuid primary key default gen_random_uuid(),
  perfil_id             uuid references perfiles(id) on delete cascade not null,
  tipo                  text not null,
  config                jsonb default '{}'::jsonb,
  activo                boolean default true,
  ultima_sincronizacion timestamptz,
  created_at            timestamptz default now(),
  unique(perfil_id, tipo)
);

alter table crm_integraciones_config enable row level security;
create policy "crm_int_config_own" on crm_integraciones_config
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create table if not exists crm_integraciones_log (
  id               uuid primary key default gen_random_uuid(),
  perfil_id        uuid references perfiles(id) on delete cascade not null,
  tipo             text not null,
  estado           text not null default 'completado',
  filas_importadas integer default 0,
  filas_error      integer default 0,
  detalle          jsonb default '{}'::jsonb,
  created_at       timestamptz default now()
);

alter table crm_integraciones_log enable row level security;
create policy "crm_int_log_own" on crm_integraciones_log
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
