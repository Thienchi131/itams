import AppLayout from "../../../components/AppLayout";
import { getUserById } from "@/modules/user/user.service";
import { requireRole } from "@/modules/auth/auth.service";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["Admin"]);

  const { id } = await params;
  const user = await getUserById(Number(id));

  if (!user) notFound();

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href={`/users/${user.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-100 text-blue-600">
            <KeyRound size={32} />
          </div>

          <div>
            <h1 className="text-4xl font-extrabold text-slate-900">
              Đổi mật khẩu
            </h1>
            <p className="mt-2 text-slate-500">{user.fullName}</p>
          </div>
        </div>

        <ChangePasswordForm userId={user.id} />
      </div>
    </AppLayout>
  );
}