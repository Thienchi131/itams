import Link from "next/link";

export default function ForgotPasswordLink() {
  return (
    <Link
      href="/forgot-password"
      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
    >
      Quên mật khẩu?
    </Link>
  );
}
