import { randomInt } from "crypto";
import type { Prisma } from "@prisma/client";

// Sinh Asset Tag dạng IT-ddmmyy-XXXXXXX, KHÔNG trùng.
//
// Trước đây phần số = Date.now() % 10.000.000 — lặp lại mỗi ~2,8 giờ, 2 lần
// nhập rơi đúng chu kỳ trong cùng ngày là trùng tag -> lỗi unique, cả phiếu
// nhập thất bại với trang lỗi chung. Giờ dùng số ngẫu nhiên an toàn và kiểm
// tra DB (+ danh sách tag đã cấp trong cùng lô) trước khi dùng.
export async function generateUniqueAssetTag(
  db: Pick<Prisma.TransactionClient, "asset">,
  usedInBatch: Set<string> = new Set()
): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);

  for (let attempt = 0; attempt < 20; attempt++) {
    const seq = String(randomInt(0, 10_000_000)).padStart(7, "0");
    const tag = `IT-${dd}${mm}${yy}-${seq}`;

    if (usedInBatch.has(tag)) continue;

    const existing = await db.asset.findUnique({
      where: { assetTag: tag },
      select: { id: true },
    });

    if (!existing) {
      usedInBatch.add(tag);
      return tag;
    }
  }

  throw new Error("Không sinh được Asset Tag không trùng sau 20 lần thử.");
}
