# Next.js Starter with Supabase Analytics

This app includes a reservation API and an admin dashboard. New bookings can automatically create a Google Calendar event using a Service Account, and reservations are persisted in Supabase for analytics over the last 90 days.

## Google Calendar setup

1. In Google Cloud Console, create a Service Account and generate a key (JSON).
2. Copy the following values into `.env.local` (use `.env.example` as a reference):

	- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
	- `GOOGLE_PRIVATE_KEY` (replace real newlines with literal `\n` in `.env` files)
	- `GOOGLE_CALENDAR_ID` (share this calendar with the service account email, with permission to add events)
	- Optionally set `GOOGLE_CALENDAR_TIMEZONE` (defaults to UTC)

3. Share the target Google Calendar with the service account email (Settings → Share with specific people).

4. Start the app and create a booking; the API will attempt to create a calendar event.

## Admin credentials (secure setup)

For security, admin credentials must not be committed to source control. Follow these steps to configure a production-safe admin account:

1. Locally (development)

	- You may use `DEV_ADMIN_USERNAME` and `DEV_ADMIN_PASSWORD` in your local `.env.local` for convenience (see `.env.example`). Do NOT commit `.env.local`.

2. Production (recommended)

	- On your production host (Vercel, Netlify, Docker, etc.) set:

	  - `ADMIN_USERNAME` — the admin username
	  - `ADMIN_PASSWORD_HASH` — bcrypt hash of the admin password (do NOT store plaintext passwords)

	- To create the bcrypt hash locally (the repo includes a helper):

```powershell
# from project root (Windows PowerShell)
node .\scripts\hash-password.mjs "YourSuperSecretPassword!"

# Output will look like: Hash: $2a$12$... -- copy that value into ADMIN_PASSWORD_HASH
```

	- Alternatively, you can set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in a staging environment, but ensure the password is never committed and rotate to `ADMIN_PASSWORD_HASH` (bcrypt) for production.

3. Runtime behavior

	- When `NODE_ENV=production` the server will refuse to start (return 500 on login attempts) if `ADMIN_USERNAME` or `ADMIN_PASSWORD_HASH` are missing. This prevents accidental insecure deployments.

4. Rotate and revoke

	- If secrets may have been exposed, rotate the password, generate a new hash, and update the environment variable on the host.

5. Extra precautions

	- Use your platform's secret manager (Vercel/Netlify/Azure/Heroku) rather than storing secrets in files.
	- Consider adding MFA and IP allowlisting in future — they are intentionally left out for now.

## Where it happens

- Calendar client: `src/lib/google-calendar.ts`
- Booking API: `src/app/api/reservations/route.ts` (POST handler creates the event)
- Supabase client (server): `src/lib/supabase/server.ts`
- Supabase client (browser): `src/lib/supabase/client.ts`
- Analytics API (90 days): `src/app/api/analytics/route.ts`
- Admin dashboard UI: `src/app/admin/page.tsx`

## Supabase setup

1. Create a project at supabase.com.
2. Copy the Project URL and anon key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # server-only
```

3. Create the `reservations` table (SQL):

```sql
create table if not exists public.reservations (
	id bigint generated always as identity primary key,
	name text not null,
	email text not null,
	phone text not null,
	guests int not null check (guests > 0),
	date date not null,
	time text not null,
	calendar_status text default 'Pending'
);

alter table public.reservations enable row level security;

-- Minimal read policies (adjust as needed)
create policy if not exists "read reservations" on public.reservations for select to anon using (true);

-- If you want public inserts without auth; otherwise rely on server service-role only
create policy if not exists "insert reservations" on public.reservations for insert to anon with check (true);
```

If you already created the table without `phone`, add it via:

```sql
alter table public.reservations add column if not exists phone text not null default '';
-- Optional: if you can't set a default, add as nullable, backfill, then set not null
-- alter table public.reservations add column if not exists phone text;
-- update public.reservations set phone = '' where phone is null;
-- alter table public.reservations alter column phone set not null;
```

4. Run the dev server:

```
npm install
npm run dev
```
