import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { readAdminAuthState, verifyPasswordHash } from './admin-credentials';

export const SESSION_COOKIE_NAME = 'py_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

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

export async function verifyLoginCredentials(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string; tokenVersion?: number }> {
  const cfg = getAuthConfig();
  if (!cfg.isConfigured) {
    return {
      ok: false,
      error: 'Chưa cấu hình biến môi trường ADMIN_PASSWORD trên Vercel.',
    };
  }

  const userMatch = safeEqual(username.trim(), cfg.username);
  if (!userMatch) {
    return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const { state } = await readAdminAuthState();
  let passMatch = false;

  if (state.passwordHash) {
    passMatch = verifyPasswordHash(password, state.passwordHash, cfg.secret);
  } else {
    passMatch = safeEqual(password, cfg.password);
  }

  if (!passMatch) {
    return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  return { ok: true, tokenVersion: state.tokenVersion };
}

export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const cfg = getAuthConfig();
  if (!cfg.isConfigured) return false;
  const { state } = await readAdminAuthState();
  if (state.passwordHash) {
    return verifyPasswordHash(password, state.passwordHash, cfg.secret);
  }
  return safeEqual(password, cfg.password);
}

interface SessionPayload {
  u: string;
  exp: number;
  v?: number;
}

export function createSessionToken(username: string, tokenVersion = 1): string {
  const cfg = getAuthConfig();
  const payload: SessionPayload = {
    u: username,
    exp: Date.now() + SESSION_TTL_MS,
    v: tokenVersion,
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

interface ResetPayload {
  p: 'pw_reset';
  e: string;
  v: number;
  exp: number;
}

export function createResetToken(email: string, tokenVersion: number): string {
  const cfg = getAuthConfig();
  const payload: ResetPayload = {
    p: 'pw_reset',
    e: email.trim().toLowerCase(),
    v: tokenVersion,
    exp: Date.now() + RESET_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', cfg.secret).update(`reset::${encoded}`).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyResetToken(
  token: string,
  expectedVersion: number
): { ok: true; email: string } | { ok: false; error: string } {
  const cfg = getAuthConfig();
  if (!cfg.isConfigured || !token) {
    return { ok: false, error: 'Liên kết đặt lại mật khẩu không hợp lệ.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'Liên kết đặt lại mật khẩu không đúng định dạng.' };
  }
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', cfg.secret).update(`reset::${encoded}`).digest('base64url');
  if (!safeEqual(sig, expectedSig)) {
    return { ok: false, error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã bị thay đổi.' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ResetPayload;
    if (payload.p !== 'pw_reset' || !payload.e) {
      return { ok: false, error: 'Liên kết đặt lại mật khẩu không hợp lệ.' };
    }
    if (payload.exp < Date.now()) {
      return { ok: false, error: 'Liên kết đặt lại mật khẩu đã hết hạn (quá 15 phút). Vui lòng yêu cầu gửi lại.' };
    }
    if (payload.v !== expectedVersion) {
      return { ok: false, error: 'Liên kết này đã được sử dụng hoặc mật khẩu đã được thay đổi trước đó.' };
    }
    return { ok: true, email: payload.e };
  } catch {
    return { ok: false, error: 'Không đọc được liên kết đặt lại mật khẩu.' };
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
