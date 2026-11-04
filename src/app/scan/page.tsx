import AppLayout from "../components/AppLayout";
import { requireLogin } from "@/modules/auth/auth.service";
import Scanner from "./Scanner";

export default async function ScanPage() {
  await requireLogin();

  return (
    <AppLayout>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Quét mã thiết bị</h2>
        <p className="mt-1 text-slate-500">
          Quét tem QR hoặc mã vạch serial để mở nhanh trang thiết bị.
        </p>
      </div>
      <Scanner />
    </AppLayout>
  );
}
