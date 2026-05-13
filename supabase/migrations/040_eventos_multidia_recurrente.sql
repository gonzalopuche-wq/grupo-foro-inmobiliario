-- Soporte para eventos de varios días o con fechas recurrentes
alter table eventos
  add column if not exists es_recurrente      boolean  not null default false,
  add column if not exists fechas_recurrentes date[],
  add column if not exists recurrencia_desc   text;

comment on column eventos.es_recurrente      is 'True si el evento tiene sesiones en fechas específicas (curso, congreso escalonado, etc.)';
comment on column eventos.fechas_recurrentes is 'Array de fechas individuales para eventos recurrentes o multi-sesión';
comment on column eventos.recurrencia_desc   is 'Descripción legible de la recurrencia: "4 últimos miércoles del mes", "3 jornadas", etc.';
