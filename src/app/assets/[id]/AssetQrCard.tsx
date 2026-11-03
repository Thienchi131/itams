"use client";

import { QRCodeCanvas } from "qrcode.react";
import { Link as LinkIcon } from "lucide-react";
import { useState } from "react";

export default function AssetQrCard({
  assetId,
  assetTag,
}: {
  assetId: number;
  assetTag: string;
}) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/assets/${assetId}`
      : "";

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-bold text-slate-900">
        QR Code thiết bị
      </h3>

      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <QRCodeCanvas value={url} size={92} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {assetTag}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Scan QR để mở nhanh trang chi tiết thiết bị.
          </p>

          <button
            type="button"
            onClick={copyUrl}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <LinkIcon size={14} />
            {copied ? "Đã copy" : "Copy link"}
          </button>
        </div>
      </div>
    </section>
  );
}