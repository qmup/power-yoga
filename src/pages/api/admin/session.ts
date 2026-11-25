import type { APIRoute } from 'astro';
import { getAuthConfig, getAuthenticatedUser } from '../../../lib/admin-auth';
import { getRecoveryEmail, maskEmail, readAdminAuthState } from '../../../lib/admin-credentials';
import { getMailerProvider } from '../../../lib/admin-mailer';
import { getStorageConfig } from '../../../lib/github-cms';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const user = getAuthenticatedUser(cookies);
  const authCfg = getAuthConfig();
  const storageCfg = getStorageConfig();
  const mailerProvider = getMailerProvider();
  const recoveryEmailFull = getRecoveryEmail();

  let passwordUpdatedAt: string | null = null;
  if (user) {
    try {
      const { state } = await readAdminAuthState();
      passwordUpdatedAt = state.updatedAt;
    } catch {
      // ignore transient error
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
      recoveryEmail: user ? recoveryEmailFull : null,
      recoveryEmailMasked: maskEmail(recoveryEmailFull),
      passwordUpdatedAt,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
};
