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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      recoveryEmail?: string;
    };

    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const rawEmail = typeof body.recoveryEmail === 'string' ? body.recoveryEmail.trim().toLowerCase() : '';

    if (!currentPassword) {
      return new Response(JSON.stringify({ ok: false, error: 'Vui lòng nhập mật khẩu hiện tại để xác nhận.' }), {
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

    if (!newPassword && !rawEmail) {
      return new Response(JSON.stringify({ ok: false, error: 'Vui lòng nhập mật khẩu mới hoặc email khôi phục mới.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (newPassword && newPassword.length < 8) {
      return new Response(JSON.stringify({ ok: false, error: 'Mật khẩu mới cần có ít nhất 8 ký tự.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (rawEmail && !EMAIL_RE.test(rawEmail)) {
      return new Response(JSON.stringify({ ok: false, error: 'Địa chỉ email khôi phục không hợp lệ.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cfg = getAuthConfig();
    const { state, sha } = await readAdminAuthState();

    const nextState = {
      recoveryEmail: rawEmail || state.recoveryEmail,
      passwordHash: newPassword ? hashPassword(newPassword, cfg.secret) : state.passwordHash,
      tokenVersion: newPassword ? state.tokenVersion + 1 : state.tokenVersion,
      updatedAt: new Date().toISOString(),
    };

    const reason = newPassword && rawEmail && rawEmail !== state.recoveryEmail
      ? 'cập nhật mật khẩu & email khôi phục'
      : newPassword
        ? 'đổi mật khẩu quản trị'
        : 'cập nhật email khôi phục';

    await writeAdminAuthState(nextState, reason, sha);

    // Refresh cookie with latest tokenVersion
    const freshToken = createSessionToken(user.u, nextState.tokenVersion);
    setSessionCookie(cookies, freshToken);

    return new Response(
      JSON.stringify({
        ok: true,
        recoveryEmail: nextState.recoveryEmail,
        updatedAt: nextState.updatedAt,
        message: newPassword
          ? 'Đã đổi mật khẩu thành công! Mật khẩu mới có hiệu lực ngay lập tức.'
          : 'Đã cập nhật email khôi phục thành công!',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Không thể cập nhật mật khẩu.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
