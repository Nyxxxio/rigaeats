-- Idempotent migration to create restaurants and admin_users and add restaurant to reservations

-- Create restaurants table (slug primary key)
CREATE TABLE IF NOT EXISTS restaurants (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  restaurant_slug TEXT REFERENCES restaurants(slug),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add restaurant column to reservations if it doesn't exist
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS restaurant TEXT DEFAULT 'singhs';

-- Optional: foreign key from reservations to restaurants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'reservations' AND tc.constraint_name = 'fk_reservation_restaurant'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT fk_reservation_restaurant
      FOREIGN KEY (restaurant) REFERENCES restaurants(slug);
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- If reservations table doesn't exist yet, skip
  RAISE NOTICE 'reservations table not found; skipping FK creation';
END$$;

-- Create index to speed up per-restaurant queries
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date ON reservations (restaurant, date, time);
