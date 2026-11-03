import nodemailer from "nodemailer";

// Created once and reused across calls instead of per-send, and never
// logged — logging even a prefix of SMTP_PASS leaks credential material.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Nhiều nhà cung cấp VPS chặn hẳn các port SMTP đi ra (25/465/587) để
  // chống spam — nếu không set timeout, nodemailer sẽ treo tới vài phút
  // chờ kết nối trước khi báo lỗi, khiến cả Server Action (và cả trang)
  // trông như bị đứng. Set ngắn lại để fail nhanh thay vì treo UI.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,
});

export async function sendUserPasswordEmail({
  to,
  fullName,
  password,
}: {
  to: string;
  fullName: string;
  password: string;
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "ITAMS Portal - Tài khoản đăng nhập",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6">
        <h2>ITAMS Portal</h2>
        <p>Xin chào <b>${fullName}</b>,</p>
        <p>Tài khoản của bạn đã được tạo.</p>

        <div style="padding: 16px; background: #f1f5f9; border-radius: 12px">
          <p><b>Email đăng nhập:</b> ${to}</p>
          <p><b>Password tạm thời:</b> ${password}</p>
        </div>

        <p>Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  to,
  fullName,
  resetUrl,
}: {
  to: string;
  fullName: string;
  resetUrl: string;
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "ITAMS Portal - Yêu cầu đặt lại mật khẩu",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6">
        <h2>ITAMS Portal</h2>
        <p>Xin chào <b>${fullName}</b>,</p>
        <p>Có yêu cầu đặt lại mật khẩu cho tài khoản <b>${to}</b>. Bấm nút bên dưới để đặt mật khẩu mới:</p>

        <p style="margin: 24px 0">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold">
            Đặt lại mật khẩu
          </a>
        </p>

        <p style="color: #64748b; font-size: 13px">
          Link này chỉ có hiệu lực trong 1 giờ và chỉ dùng được 1 lần.
          Nếu bạn không yêu cầu đặt lại mật khẩu, có thể bỏ qua email này —
          mật khẩu hiện tại của bạn vẫn an toàn và không bị thay đổi.
        </p>

        <p style="color: #94a3b8; font-size: 12px">
          Nếu nút bấm ở trên không hoạt động, sao chép đường link sau vào trình duyệt:<br />
          ${resetUrl}
        </p>
      </div>
    `,
  });
}