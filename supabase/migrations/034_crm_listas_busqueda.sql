create table if not exists crm_listas_busqueda (
  id uuid primary key default gen_random_uuid(),
  corredor_id uuid not null,
  contacto_id uuid,
  nombre text not null,
  descripcion text,
  slug text unique default substring(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  criterios jsonb not null default '{}'::jsonb,
  email_cliente text,
  notificar_cliente boolean not null default true,
  publica boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clb_corredor on crm_listas_busqueda(corredor_id);
create index if not exists idx_clb_slug on crm_listas_busqueda(slug) where slug is not null;

alter table crm_listas_busqueda enable row level security;

create policy clb_all on crm_listas_busqueda for all to authenticated using (corredor_id = auth.uid()) with check (corredor_id = auth.uid());
create policy clb_pub on crm_listas_busqueda for select using (publica = true);

create table if not exists crm_propiedades_guardadas (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references crm_listas_busqueda(id) on delete cascade,
  corredor_id uuid not null,
  url_original text not null,
  titulo text,
  tipo text,
  operacion text,
  precio_actual numeric,
  moneda text default 'USD',
  ciudad text,
  zona text,
  dormitorios int,
  banos int,
  superficie_cubierta numeric,
  superficie_total numeric,
  fotos text[] default array[]::text[],
  foto_url text,
  destacada boolean not null default false,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lista_id, url_original)
);

create index if not exists idx_cpg_lista on crm_propiedades_guardadas(lista_id);
create index if not exists idx_cpg_corredor on crm_propiedades_guardadas(corredor_id);

alter table crm_propiedades_guardadas enable row level security;

create policy cpg_all on crm_propiedades_guardadas for all to authenticated using (corredor_id = auth.uid()) with check (corredor_id = auth.uid());
create policy cpg_pub on crm_propiedades_guardadas for select using (exists (select 1 from crm_listas_busqueda l where l.id = lista_id and l.publica = true));

create table if not exists crm_busqueda_alertas (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid references crm_propiedades_guardadas(id) on delete cascade,
  lista_id uuid references crm_listas_busqueda(id) on delete cascade,
  corredor_id uuid not null,
  tipo text not null,
  valor_anterior text,
  valor_nuevo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cba_lista on crm_busqueda_alertas(lista_id, created_at desc);

alter table crm_busqueda_alertas enable row level security;

create policy cba_all on crm_busqueda_alertas for all to authenticated using (corredor_id = auth.uid()) with check (corredor_id = auth.uid());
