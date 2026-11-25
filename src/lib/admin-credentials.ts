import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getStorageConfig } from './github-cms';

const AUTH_REPO_PATH = 'src/data/admin-auth.json';
const PROD_RECOVERY_EMAIL = 'poweryogabienhoa@gmail.com';
const DEV_RECOVERY_EMAIL = 'quannmse@gmail.com';

export interface StoredAdminAuth {
  passwordHash: string | null;
  tokenVersion: number;
  updatedAt: string | null;
}

function getEnv(key: string): string | undefined {
  return process.env[key] || (import.meta.env as Record<string, string | undefined>)[key];
}

export function getRecoveryEmail(): string {
  const override = getEnv('ADMIN_RECOVERY_EMAIL')?.trim().toLowerCase();
  if (override) return override;

  const vercelEnv = getEnv('VERCEL_ENV'); // 'production' | 'preview' | 'development' | undefined
  const isDevOrPreview = Boolean(import.meta.env.DEV) || vercelEnv === 'development' || vercelEnv === 'preview';
  return isDevOrPreview ? DEV_RECOVERY_EMAIL : PROD_RECOVERY_EMAIL;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}***@${domain}`;
}

function getDefaultAuthState(): StoredAdminAuth {
  return {
    passwordHash: null,
    tokenVersion: 1,
    updatedAt: null,
  };
}

export function hashPassword(password: string, pepper: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(`${password}::${pepper}`, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasswordHash(password: string, storedHash: string, pepper: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(`${password}::${pepper}`, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export async function readAdminAuthState(): Promise<{ state: StoredAdminAuth; sha?: string }> {
  const cfg = getStorageConfig();
  const fallback = getDefaultAuthState();

  if (cfg.mode === 'github') {
    const res = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${AUTH_REPO_PATH}?ref=${encodeURIComponent(cfg.branch)}`,
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'power-yoga-admin-cms',
        },
      }
    );

    if (res.status === 404) {
      return { state: fallback };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Không đọc được cấu hình tài khoản từ GitHub (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as { content?: string; sha?: string };
    const decoded = Buffer.from(String(json.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<StoredAdminAuth>;
    return {
      sha: json.sha,
      state: {
        passwordHash: typeof parsed.passwordHash === 'string' && parsed.passwordHash ? parsed.passwordHash : null,
        tokenVersion: typeof parsed.tokenVersion === 'number' && parsed.tokenVersion >= 1 ? parsed.tokenVersion : 1,
        updatedAt: parsed.updatedAt || null,
      },
    };
  }

  if (cfg.mode === 'local') {
    const fullPath = path.join(process.cwd(), AUTH_REPO_PATH);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredAdminAuth>;
      return {
        state: {
          passwordHash: typeof parsed.passwordHash === 'string' && parsed.passwordHash ? parsed.passwordHash : null,
          tokenVersion: typeof parsed.tokenVersion === 'number' && parsed.tokenVersion >= 1 ? parsed.tokenVersion : 1,
          updatedAt: parsed.updatedAt || null,
        },
      };
    } catch {
      return { state: fallback };
    }
  }

  return { state: fallback };
}

export async function writeAdminAuthState(
  nextState: StoredAdminAuth,
  reason: string,
  existingSha?: string
): Promise<void> {
  const cfg = getStorageConfig();
  const content = JSON.stringify(nextState, null, 2) + '\n';

  if (cfg.mode === 'local') {
    const fullPath = path.join(process.cwd(), AUTH_REPO_PATH);
    await fs.writeFile(fullPath, content, 'utf8');
    return;
  }

  if (cfg.mode === 'github') {
    // Include [skip ci] so password updates take effect immediately without wasting a Vercel build
    const body: Record<string, unknown> = {
      message: `auth: ${reason} [skip ci]`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: cfg.branch,
    };
    if (existingSha) {
      body.sha = existingSha;
    }

    const res = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${AUTH_REPO_PATH}`,
      {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'power-yoga-admin-cms',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Không lưu được thông tin bảo mật lên GitHub (${res.status}): ${txt.slice(0, 200)}`);
    }
    return;
  }

  throw new Error('Chưa cấu hình biến môi trường GITHUB_TOKEN trên Vercel.');
}
