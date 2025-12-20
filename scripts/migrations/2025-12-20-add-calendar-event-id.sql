-- Add calendar_event_id to reservations for syncing with Google Calendar

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Optional index to speed up lookups by calendar event
CREATE INDEX IF NOT EXISTS idx_reservations_calendar_event_id
  ON reservations (calendar_event_id);
