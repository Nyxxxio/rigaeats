-- Add reservation_code to reservations for human-friendly IDs

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reservation_code TEXT;

-- Ensure codes are unique for easier lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_name = 'reservations'
      AND tc.constraint_name = 'reservations_reservation_code_key'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_reservation_code_key UNIQUE (reservation_code);
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- If reservations table doesn't exist yet, skip
  RAISE NOTICE 'reservations table not found; skipping reservation_code migration';
END$$;