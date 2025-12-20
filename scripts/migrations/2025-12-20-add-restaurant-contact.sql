-- Add address and phone columns to restaurants for email/contact details

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;
