-- Configuración de notificaciones push por evento
alter table eventos
  add column if not exists notif_activa        boolean      not null default true,
  add column if not exists notif_frecuencia    int          not null default 2,   -- veces por semana (1-3)
  add column if not exists notif_audiencia     text         not null default 'todos',  -- todos | corredores | vip
  add column if not exists notif_ultimo_envio  timestamptz,
  add column if not exists notif_total_enviadas int         not null default 0,
  -- pauta paga: organizadores externos que pagan por difusión
  add column if not exists es_pauta            boolean      not null default false,
  add column if not exists pauta_organizador   text,
  add column if not exists pauta_monto         numeric;

comment on column eventos.notif_frecuencia  is 'Notificaciones push por semana (1 = semanal, 2 = bisemanal, 3 = triemanal)';
comment on column eventos.notif_audiencia   is 'Segmento destino: todos | corredores | vip';
comment on column eventos.es_pauta          is 'True si el organizador externo pagó por difusión (proveedor)';
