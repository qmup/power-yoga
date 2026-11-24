import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE_NAME = 'py_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getEnv(key: string): string | undefined {
  return process.env[key] || (import.meta.env as Record<string, string | undefined>)[key];
}

export function getAuthConfig() {
  const isDev = Boolean(import.meta.env.DEV);
  const username = (getEnv('ADMIN_USERNAME') || 'admin').trim();
  const password = getEnv('ADMIN_PASSWORD') || (isDev ? 'poweryoga2026' : '');
  const secret =
    getEnv('ADMIN_SESSION_SECRET') ||
    (password ? crypto.createHash('sha256').update(`${password}::power-yoga-admin-v1`).digest('hex') : '');

  return {
    isDev,
    username,
    password,
    secret,
    isConfigured: Boolean(password && secret),
    usingDevFallback: isDev && !getEnv('ADMIN_PASSWORD'),
  };
}

function safeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyCredentials(username: string, password: string): { ok: boolean; error?: string } {
  const cfg = getAuthConfig();
  if (!cfg.isConfigured) {
    return {
      ok: false,
      error: 'Chưa cấu hình biến môi trường ADMIN_PASSWORD trên Vercel.',
    };
  }
  const userMatch = safeEqual(username.trim(), cfg.username);
  const passMatch = safeEqual(password, cfg.password);
  if (!userMatch || !passMatch) {
    return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }
  return { ok: true };
}

interface SessionPayload {
  u: string;
  exp: number;
}

export function createSessionToken(username: string): string {
  const cfg = getAuthConfig();
  const payload: SessionPayload = {
    u: username,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', cfg.secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const cfg = getAuthConfig();
  if (!cfg.isConfigured) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', cfg.secret).update(encoded).digest('base64url');
  if (!safeEqual(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.u || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(cookies: AstroCookies, token: string) {
  const isProd = !import.meta.env.DEV;
  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

export function getAuthenticatedUser(cookies: AstroCookies): SessionPayload | null {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
