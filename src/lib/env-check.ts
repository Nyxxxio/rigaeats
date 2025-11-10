// Runtime environment validation helper.
// Keep checks minimal and avoid printing secret values.
export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const missing: string[] = [];

  // Critical for authentication
  if (!process.env.AUTH_SECRET) missing.push('AUTH_SECRET');
  if (!process.env.ADMIN_USERNAME) missing.push('ADMIN_USERNAME');
  if (!process.env.ADMIN_PASSWORD_HASH) missing.push('ADMIN_PASSWORD_HASH');

  if (isProd) {
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for production: ${missing.join(', ')}. ` +
          `Set them using your platform's secret manager and restart the server.`
      );
    }
  } else {
    // In development, warn but do not crash. Encourage using DEV_* vars instead of committing secrets.
    if (missing.length > 0) {
      // Only warn about auth-related missing vars to avoid noise.
      console.warn(
        `Warning: missing environment variables (${missing.join(', ')}). ` +
          `For local development you can set DEV_ADMIN_USERNAME / DEV_ADMIN_PASSWORD or ` +
          `ADMIN_USERNAME / ADMIN_PASSWORD_HASH in a .env.local file (do NOT commit it).`
      );
    }
  }
}

export default validateEnv;
