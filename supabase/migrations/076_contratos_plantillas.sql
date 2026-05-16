-- Plantillas de contratos por corredor
create table if not exists contratos_plantillas (
  id          uuid        primary key default gen_random_uuid(),
  perfil_id   uuid        references perfiles(id) on delete cascade not null,
  nombre      text        not null,
  tipo        text        not null default 'general',
  contenido   text        not null,
  created_at  timestamptz not null default now()
);

alter table contratos_plantillas enable row level security;

create policy "contratos_plantillas_owner"
  on contratos_plantillas
  for all
  using  (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

create index if not exists idx_contratos_plantillas_perfil
  on contratos_plantillas(perfil_id, created_at desc);
