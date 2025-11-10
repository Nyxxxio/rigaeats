// JWT-based auth utilities with secret rotation and token versioning
import { SignJWT, jwtVerify, JWTPayload } from 'jose';

export type AdminTokenPayload = JWTPayload & {
  sub: string; // 'admin'
  username: string;
  ver: string; // token version
  restaurant?: string; // restaurant slug (e.g., 'singhs')
};

function getSecrets() {
  const current = process.env.AUTH_SECRET || 'change-me-dev-secret';
  const previous = process.env.AUTH_SECRET_PREV || undefined;
  const version = process.env.AUTH_TOKEN_VERSION || '1';
  return { current, previous, version };
}

export async function signToken(payload: { sub: string; username: string; restaurant?: string }, ttlSeconds = 8 * 60 * 60) {
  const { current, version } = getSecrets();
  const enc = new TextEncoder();
  const key = enc.encode(current);
  const claims: any = { username: payload.username, ver: version };
  if (payload.restaurant) claims.restaurant = payload.restaurant;
  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
  return jwt;
}

export async function verifyToken(token: string): Promise<AdminTokenPayload | null> {
  const { current, previous, version } = getSecrets();
  const enc = new TextEncoder();
  const keys = [current, previous].filter(Boolean) as string[];
  for (const s of keys) {
    try {
      const { payload } = await jwtVerify(token, enc.encode(s));
      if ((payload as any).ver !== version) continue; // invalidated by version bump
      return payload as AdminTokenPayload;
    } catch (e) {
      // try next key
    }
  }
  return null;
}
