import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeHandoverPhotoDueAt,
  getHandoverPhotoStatus,
  HANDOVER_PHOTO_DUE_DAYS,
  HANDOVER_PHOTO_FILENAME_RE,
  isJpegBuffer,
} from "./handover-photo.helpers.ts";

const DAY = 24 * 60 * 60 * 1000;

test("computeHandoverPhotoDueAt cộng đúng 7 ngày", () => {
  const from = new Date("2026-11-05T06:00:00Z");
  const due = computeHandoverPhotoDueAt(from);
  assert.equal(due.getTime() - from.getTime(), HANDOVER_PHOTO_DUE_DAYS * DAY);
});

test("getHandoverPhotoStatus: đã có ảnh thì luôn done, kể cả quá hạn", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  assert.deepEqual(getHandoverPhotoStatus(new Date("2026-11-10T00:00:00Z"), 1, now), {
    kind: "done",
  });
});

test("getHandoverPhotoStatus: không có hạn (lượt bàn giao cũ) thì none", () => {
  assert.deepEqual(getHandoverPhotoStatus(null, 0), { kind: "none" });
});

test("getHandoverPhotoStatus: còn hạn", () => {
  const now = new Date("2026-11-05T00:00:00Z");
  const due = new Date(now.getTime() + 7 * DAY);
  assert.deepEqual(getHandoverPhotoStatus(due, 0, now), { kind: "pending", daysRemaining: 7 });
  assert.deepEqual(getHandoverPhotoStatus(new Date(now.getTime() + 2 * 60 * 60 * 1000), 0, now), {
    kind: "pending",
    daysRemaining: 1,
  });
  assert.deepEqual(getHandoverPhotoStatus(new Date(now.getTime() + 6.5 * DAY), 0, now), {
    kind: "pending",
    daysRemaining: 7,
  });
});

test("getHandoverPhotoStatus: quá hạn ít nhất 1 ngày", () => {
  const now = new Date("2026-11-05T00:00:00Z");
  assert.deepEqual(getHandoverPhotoStatus(new Date(now.getTime() - 60 * 1000), 0, now), {
    kind: "overdue",
    daysOverdue: 1,
  });
  assert.deepEqual(getHandoverPhotoStatus(new Date(now.getTime() - 3 * DAY), 0, now), {
    kind: "overdue",
    daysOverdue: 3,
  });
});

test("isJpegBuffer nhận đúng JPEG, từ chối PNG/HTML/rỗng", () => {
  assert.equal(isJpegBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])), true);
  assert.equal(isJpegBuffer(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])), false);
  assert.equal(isJpegBuffer(new TextEncoder().encode("<html>")), false);
  assert.equal(isJpegBuffer(new Uint8Array([])), false);
});

test("HANDOVER_PHOTO_FILENAME_RE chặn path traversal", () => {
  assert.equal(
    HANDOVER_PHOTO_FILENAME_RE.test("2026/11/0b7c7a39-3f6c-4c39-9d7e-2f1b0a6c9e11.jpg"),
    true
  );
  assert.equal(HANDOVER_PHOTO_FILENAME_RE.test("../../etc/passwd"), false);
  assert.equal(
    HANDOVER_PHOTO_FILENAME_RE.test("2026/11/../0b7c7a39-3f6c-4c39-9d7e-2f1b0a6c9e11.jpg"),
    false
  );
  assert.equal(
    HANDOVER_PHOTO_FILENAME_RE.test("/2026/11/0b7c7a39-3f6c-4c39-9d7e-2f1b0a6c9e11.jpg"),
    false
  );
});
