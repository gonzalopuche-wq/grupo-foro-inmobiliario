-- Persistencia de calendarios Google Calendar vinculados en la agenda
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS gcal_calendarios jsonb DEFAULT '[]'::jsonb;
