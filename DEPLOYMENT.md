Deployment checklist and environment variables

Quick checklist

1. Create a Supabase project and run the SQL in `scripts/migrations/2025-11-06-init.sql` using the SQL editor. Also run `scripts/migrations/2025-11-06-admin-audit.sql` to add the admin audit table used by the management UI.
2. Run the seed script locally or in a secure environment to create the initial restaurant and admin user:

   ```powershell
   # set these in your shell or CI secrets
   $env:NEXT_PUBLIC_SUPABASE_URL = '<url>'
   $env:SUPABASE_SERVICE_ROLE_KEY = '<service-role-key>'
   node scripts/seed-admin.mjs
   ```

3. Configure production environment variables in your host (Vercel/Render/Fly):

   Required (server-only secrets must be added to the host's secret manager):
   - AUTH_SECRET (long random string)
   - AUTH_SECRET_PREV (previous secret for rotation, optional)
   - AUTH_TOKEN_VERSION (e.g., 1)
   - NEXT_PUBLIC_SUPABASE_URL (public client URL)
   - SUPABASE_SERVICE_ROLE_KEY (server-only; never expose to clients)
   - GOOGLE_SERVICE_ACCOUNT_EMAIL
   - GOOGLE_PRIVATE_KEY (use \n for newlines)
   - GOOGLE_CALENDAR_ID
   - ADMIN_MANAGEMENT_SECRET (server-only; do NOT expose this as NEXT_PUBLIC_ in any environment)

   Optional:
   - DEFAULT_RESTAURANT_SLUG (defaults to 'singhs')
   - REDIS_URL (if you want Redis-backed global rate limiter)

4. Build and deploy on Vercel: set project, add environment variables, and set build command `npm run build`.

Notes and security recommendations

- Keep SUPABASE_SERVICE_ROLE_KEY in a secure server env — do not expose it to clients.
- Use ADMIN_MANAGEMENT_SECRET for automation (CI seeds) rather than exposing admin creation publicly.
- Consider enabling Supabase Row Level Security and policies if you plan to expose a client-side key.
- If you run multiple instances, provide REDIS_URL to enable global rate limiting.

CI

- A sample GitHub Actions workflow is included at `.github/workflows/ci.yml` (runs typecheck and build under NODE_ENV=development to avoid production env-check failure in CI). Update as needed for your environment.
