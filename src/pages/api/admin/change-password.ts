import type { APIRoute } from 'astro';
import {
  createSessionToken,
  getAuthConfig,
  getAuthenticatedUser,
  setSessionCookie,
  verifyCurrentPassword,
} from '../../../lib/admin-auth';
import { hashPassword, readAdminAuthState, writeAdminAuthState } from '../../../lib/admin-credentials';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getAuthenticatedUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Chưa đăng nhập.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword) {
      return new Response(JSON.stringify({ ok: false, error: 'Vui lòng nhập mật khẩu hiện tại.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validCurrent = await verifyCurrentPassword(currentPassword);
    if (!validCurrent) {
      return new Response(JSON.stringify({ ok: false, error: 'Mật khẩu hiện tại không đúng.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ ok: false, error: 'Mật khẩu mới cần có ít nhất 8 ký tự.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cfg = getAuthConfig();
    const { state, sha } = await readAdminAuthState();

    const nextState = {
      passwordHash: hashPassword(newPassword, cfg.secret),
      tokenVersion: state.tokenVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    await writeAdminAuthState(nextState, 'đổi mật khẩu quản trị', sha);

    const freshToken = createSessionToken(user.u, nextState.tokenVersion);
    setSessionCookie(cookies, freshToken);

    return new Response(
      JSON.stringify({
        ok: true,
        updatedAt: nextState.updatedAt,
        message: 'Đã đổi mật khẩu thành công! Mật khẩu mới có hiệu lực ngay lập tức.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Không thể đổi mật khẩu.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
