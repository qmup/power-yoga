import type { APIRoute } from 'astro';
import { getAuthenticatedUser } from '../../../lib/admin-auth';
import { publishCmsChanges, readCmsData, type PublishPayload } from '../../../lib/github-cms';

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
    const result = await readCmsData();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Không đọc được dữ liệu' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getAuthenticatedUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await request.json()) as PublishPayload;
    const result = await publishCmsChanges(payload);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Lưu thay đổi thất bại' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
