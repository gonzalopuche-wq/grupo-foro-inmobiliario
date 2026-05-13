-- Tickets de soporte técnico
create table if not exists soporte_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references perfiles(id) on delete cascade,
  asunto      text not null,
  descripcion text not null,
  estado      text not null default 'abierto'
                check (estado in ('abierto','en_proceso','resuelto','cerrado')),
  prioridad   text not null default 'normal'
                check (prioridad in ('baja','normal','alta','urgente')),
  respuesta   text,
  respuesta_ia text,
  admin_id    uuid references perfiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table soporte_tickets enable row level security;

-- Usuarios ven solo sus propios tickets; admins ven todos
create policy "soporte_select" on soporte_tickets for select
  using (
    auth.uid() = user_id
    or exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin')
  );

-- Solo el propio usuario puede crear tickets
create policy "soporte_insert" on soporte_tickets for insert
  with check (auth.uid() = user_id);

-- Solo admins pueden actualizar (responder, cambiar estado)
create policy "soporte_update" on soporte_tickets for update
  using (exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin'));

-- Solo admins pueden eliminar
create policy "soporte_delete" on soporte_tickets for delete
  using (exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin'));
