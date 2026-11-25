import type { APIRoute } from 'astro';
import { createResetToken } from '../../../lib/admin-auth';
import { readAdminAuthState } from '../../../lib/admin-credentials';
import { getMailerProvider, sendPasswordResetEmail } from '../../../lib/admin-mailer';

export const prerender = false;

// Lightweight cooldown per serverless instance (30s between sends)
let lastSentAt = 0;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { email?: string };
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'Vui lòng nhập địa chỉ email hợp lệ.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (getMailerProvider() === 'unconfigured') {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            'Chức năng gửi email chưa được cấu hình trên Vercel (cần thêm SMTP_USER + SMTP_PASS hoặc RESEND_API_KEY).',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    if (now - lastSentAt < 25_000 && !import.meta.env.DEV) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Vui lòng chờ khoảng 30 giây trước khi gửi yêu cầu tiếp theo.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { state } = await readAdminAuthState();
    const genericMsg =
      'Nếu email khớp với email khôi phục đã đăng ký, liên kết đặt lại mật khẩu (hiệu lực 15 phút) đã được gửi. Vui lòng kiểm tra hộp thư đến hoặc mục Spam.';

    if (email !== state.recoveryEmail.trim().toLowerCase()) {
      return new Response(JSON.stringify({ ok: true, message: genericMsg }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = createResetToken(state.recoveryEmail, state.tokenVersion);
    const reqOrigin = request.headers.get('origin');
    const fwdHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const fwdProto = request.headers.get('x-forwarded-proto') || 'https';
    const origin =
      (reqOrigin && /^https?:\/\//i.test(reqOrigin) ? reqOrigin : '') ||
      (fwdHost ? `${fwdProto}://${fwdHost}` : '') ||
      process.env.SITE_URL ||
      new URL(request.url).origin;
    const resetUrl = `${origin.replace(/\/+$/, '')}/admin?reset=${encodeURIComponent(token)}`;

    const mailRes = await sendPasswordResetEmail(state.recoveryEmail, resetUrl);
    lastSentAt = now;

    return new Response(
      JSON.stringify({
        ok: true,
        message:
          mailRes.provider === 'dev-preview'
            ? 'Chế độ phát triển cục bộ: Chưa cấu hình SMTP/Resend nên hiển thị trực tiếp link đặt lại mật khẩu bên dưới.'
            : genericMsg,
        ...(mailRes.devResetUrl ? { devResetUrl: mailRes.devResetUrl } : {}),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Không thể gửi email khôi phục.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
