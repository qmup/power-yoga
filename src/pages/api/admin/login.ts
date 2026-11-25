import type { APIRoute } from 'astro';
import { createSessionToken, setSessionCookie, verifyLoginCredentials } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = String(body.username || '');
    const password = String(body.password || '');

    const result = await verifyLoginCredentials(username, password);
    if (!result.ok) {
      return new Response(JSON.stringify({ ok: false, error: result.error }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = createSessionToken(username.trim(), result.tokenVersion || 1);
    setSessionCookie(cookies, token);

    return new Response(JSON.stringify({ ok: true, username: username.trim() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Lỗi đăng nhập' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
