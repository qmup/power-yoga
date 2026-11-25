import type { APIRoute } from 'astro';
import { getAuthConfig, getAuthenticatedUser } from '../../../lib/admin-auth';
import { readAdminAuthState } from '../../../lib/admin-credentials';
import { getMailerProvider } from '../../../lib/admin-mailer';
import { getStorageConfig } from '../../../lib/github-cms';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const user = getAuthenticatedUser(cookies);
  const authCfg = getAuthConfig();
  const storageCfg = getStorageConfig();
  const mailerProvider = getMailerProvider();

  let recoveryEmail: string | null = null;
  let passwordUpdatedAt: string | null = null;

  if (user) {
    try {
      const { state } = await readAdminAuthState();
      recoveryEmail = state.recoveryEmail;
      passwordUpdatedAt = state.updatedAt;
    } catch {
      // Keep null if storage is temporarily unavailable
    }
  }

  return new Response(
    JSON.stringify({
      authenticated: Boolean(user),
      username: user?.u || null,
      usingDevFallback: authCfg.usingDevFallback,
      authConfigured: authCfg.isConfigured,
      storageMode: storageCfg.mode,
      repo: storageCfg.owner && storageCfg.repo ? `${storageCfg.owner}/${storageCfg.repo}` : null,
      branch: storageCfg.branch,
      mailerProvider,
      mailerConfigured: mailerProvider !== 'unconfigured',
      recoveryEmail,
      passwordUpdatedAt,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
};
