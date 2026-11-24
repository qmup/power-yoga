import type { APIRoute } from 'astro';
import { getAuthConfig, getAuthenticatedUser } from '../../../lib/admin-auth';
import { getStorageConfig } from '../../../lib/github-cms';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const user = getAuthenticatedUser(cookies);
  const authCfg = getAuthConfig();
  const storageCfg = getStorageConfig();

  return new Response(
    JSON.stringify({
      authenticated: Boolean(user),
      username: user?.u || null,
      usingDevFallback: authCfg.usingDevFallback,
      authConfigured: authCfg.isConfigured,
      storageMode: storageCfg.mode,
      repo: storageCfg.owner && storageCfg.repo ? `${storageCfg.owner}/${storageCfg.repo}` : null,
      branch: storageCfg.branch,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
};
