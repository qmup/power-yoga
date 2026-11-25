import type { APIRoute } from 'astro';
import { getAuthConfig, verifyResetToken } from '../../../lib/admin-auth';
import { hashPassword, readAdminAuthState, writeAdminAuthState } from '../../../lib/admin-credentials';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { token?: string; newPassword?: string };
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Thiếu mã xác thực đặt lại mật khẩu.' }), {
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

    const { state, sha } = await readAdminAuthState();
    const check = verifyResetToken(token, state.tokenVersion);
    if (!check.ok) {
      return new Response(JSON.stringify({ ok: false, error: check.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cfg = getAuthConfig();
    const nextState = {
      passwordHash: hashPassword(newPassword, cfg.secret),
      tokenVersion: state.tokenVersion + 1, // Immediately invalidates this reset link
      updatedAt: new Date().toISOString(),
    };

    await writeAdminAuthState(nextState, 'đặt lại mật khẩu qua email khôi phục', sha);

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
