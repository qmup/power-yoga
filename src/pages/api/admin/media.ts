import type { APIRoute } from 'astro';
import { getAuthenticatedUser } from '../../../lib/admin-auth';
import { listMediaFiles } from '../../../lib/github-cms';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const user = getAuthenticatedUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Chưa đăng nhập' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const files = await listMediaFiles();
    return new Response(JSON.stringify({ ok: true, files }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Không tải được thư viện ảnh' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
