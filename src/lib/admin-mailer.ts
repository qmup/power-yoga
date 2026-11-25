import nodemailer from 'nodemailer';

function getEnv(key: string): string | undefined {
  return process.env[key] || (import.meta.env as Record<string, string | undefined>)[key];
}

export function getMailerProvider(): 'resend' | 'smtp' | 'dev-preview' | 'unconfigured' {
  if (getEnv('RESEND_API_KEY')?.trim()) return 'resend';
  if (getEnv('SMTP_USER')?.trim() && getEnv('SMTP_PASS')?.trim()) return 'smtp';
  if (import.meta.env.DEV) return 'dev-preview';
  return 'unconfigured';
}

export interface SendResetEmailResult {
  provider: 'resend' | 'smtp' | 'dev-preview';
  devResetUrl?: string;
}

function buildResetEmailHtml(resetUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#FAF7F2; padding:32px 16px; color:#241F1B;">
      <div style="max-width:520px; margin:0 auto; background:#FFFFFF; border:1px solid #E9E0D2; border-radius:20px; padding:32px;">
        <p style="margin:0; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#9C754D; font-weight:600;">
          Power Yoga Đồng Nai · Quản trị Website
        </p>
        <h1 style="margin:10px 0 0; font-size:24px; line-height:1.3; color:#241F1B;">
          Yêu cầu đặt lại mật khẩu
        </h1>
        <p style="margin:14px 0 0; font-size:15px; line-height:1.65; color:#595047;">
          Bạn vừa yêu cầu đặt lại mật khẩu đăng nhập trang quản trị <strong>Power Yoga</strong>. Bấm nút bên dưới để tạo mật khẩu mới (liên kết có hiệu lực trong <strong>15 phút</strong> và chỉ dùng 1 lần):
        </p>
        <div style="margin:26px 0; text-align:center;">
          <a href="${resetUrl}" style="display:inline-block; background:#485741; color:#FAF7F2; text-decoration:none; font-weight:600; font-size:15px; padding:14px 28px; border-radius:999px;">
            Đặt lại mật khẩu mới
          </a>
        </div>
        <p style="margin:0; font-size:12px; line-height:1.6; color:#7B7065;">
          Nếu nút không bấm được, hãy copy đường dẫn này dán vào trình duyệt:<br />
          <a href="${resetUrl}" style="color:#485741; word-break:break-all;">${resetUrl}</a>
        </p>
        <hr style="border:none; border-top:1px solid #E9E0D2; margin:22px 0;" />
        <p style="margin:0; font-size:12px; color:#7B7065;">
          Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại của bạn vẫn an toàn.
        </p>
      </div>
    </div>
  `;
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<SendResetEmailResult> {
  const provider = getMailerProvider();
  const subject = '[Power Yoga] Liên kết đặt lại mật khẩu quản trị';
  const html = buildResetEmailHtml(resetUrl);
  const text = `Yêu cầu đặt lại mật khẩu trang quản trị Power Yoga.\nMở đường dẫn sau trong vòng 15 phút để đặt mật khẩu mới:\n${resetUrl}\n\nNếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.`;

  if (provider === 'resend') {
    const apiKey = getEnv('RESEND_API_KEY')!.trim();
    const from = (getEnv('RESEND_FROM') || 'Power Yoga Admin <onboarding@resend.dev>').trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`Gửi email qua Resend thất bại (${res.status}): ${errTxt.slice(0, 220)}`);
    }
    return { provider: 'resend' };
  }

  if (provider === 'smtp') {
    const user = getEnv('SMTP_USER')!.trim();
    const pass = getEnv('SMTP_PASS')!.trim().replace(/\s+/g, '');
    const host = (getEnv('SMTP_HOST') || 'smtp.gmail.com').trim();
    const port = Number(getEnv('SMTP_PORT') || 465);
    const secure = port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Power Yoga Admin" <${user}>`,
      to: toEmail,
      subject,
      text,
      html,
    });
    return { provider: 'smtp' };
  }

  if (provider === 'dev-preview') {
    console.log(`\n[Power Yoga Dev Reset Link] -> ${toEmail}\n${resetUrl}\n`);
    return { provider: 'dev-preview', devResetUrl: resetUrl };
  }

  throw new Error(
    'Chưa cấu hình dịch vụ gửi email trên Vercel (cần thêm SMTP_USER + SMTP_PASS cho Gmail App Password, hoặc RESEND_API_KEY).'
  );
}
