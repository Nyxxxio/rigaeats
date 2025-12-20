-- Seed two Singh's locations with address and phone

INSERT INTO restaurants (slug, name, address, phone)
VALUES
  ('singhs_pulkveza', 'Singh''s', 'Pulkveža Brieža iela 2, Centra rajons, Rīga, LV-1010', '(+371) 6331-1909'),
  ('singhs_gertrudes', 'Singh''s', 'Ģertrūdes iela 32, Centra rajons, Rīga, LV-1011', '(+371) 6331-1909')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone;
