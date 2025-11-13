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

3. Configure production environment variables in your host (Azure/Vercel/Render/Fly):

   Required (server-only secrets must be added to the host's secret manager):
   - AUTH_SECRET (long random string)
   - AUTH_SECRET_PREV (previous secret for rotation, optional)
   - AUTH_TOKEN_VERSION (e.g., 1)
   - NEXT_PUBLIC_SUPABASE_URL (public client URL)
   - NEXT_PUBLIC_SUPABASE_ANON_KEY (public anon key used by browser client)
   - SUPABASE_SERVICE_ROLE_KEY (server-only; never expose to clients)
   - GOOGLE_SERVICE_ACCOUNT_EMAIL
   - GOOGLE_PRIVATE_KEY (use \n for newlines)
   - GOOGLE_CALENDAR_ID
   - ADMIN_MANAGEMENT_SECRET (server-only; do NOT expose this as NEXT_PUBLIC_ in any environment)

   Optional:
   - DEFAULT_RESTAURANT_SLUG (defaults to 'singhs')
   - REDIS_URL (if you want Redis-backed global rate limiter)

4. Azure App Service deployment (recommended for this repo)

    One-time Azure setup

    - Create App Service (Linux):
       - Publish: Code; Runtime stack: Node 20 LTS (or 18 LTS); OS: Linux
    - App Settings: App Service → Settings → Configuration → Application settings → add the required env vars listed above; Save and restart
    - Startup Command: App Service → Configuration → General settings → Startup command: `node server.js`
    - Publish profile: App Service → Overview → Get publish profile (download the file)
    - In GitHub repo → Settings → Secrets and variables → Actions:
       - Secrets: `AZURE_PUBLISH_PROFILE` = contents of the downloaded publish profile file
       - Variables: `AZURE_WEBAPP_NAME` = your Azure App Service name

    CI/CD via GitHub Actions

    - A workflow is included at `.github/workflows/azure-appservice.yml` that:
       - Builds with Node 20, packages Next.js standalone output into `out_azure`, and deploys to Azure using the publish profile
       - Performs a post-deploy health check against `/api/health`
    - Trigger by pushing to `main` or manually via the Actions tab

    Verify after deploy
    - Open `https://<AZURE_WEBAPP_NAME>.azurewebsites.net/api/health` and confirm an OK JSON response
    - Visit `/login` → log in → confirm redirect to `/admin`

Notes and security recommendations

- Keep SUPABASE_SERVICE_ROLE_KEY in a secure server env — do not expose it to clients. The only public Supabase key in the browser is NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Use ADMIN_MANAGEMENT_SECRET for automation (CI seeds) rather than exposing admin creation publicly.
- Consider enabling Supabase Row Level Security and policies if you plan to expose a client-side key.
- If you run multiple instances, provide REDIS_URL to enable global rate limiting.

CI

- A sample GitHub Actions workflow is included at `.github/workflows/ci.yml` (runs typecheck and build under NODE_ENV=development to avoid production env-check failure in CI). Update as needed for your environment.
