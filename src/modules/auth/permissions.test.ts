import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessMenu,
  canEditData,
  getDefaultRouteForRole,
  ROLE_ADMIN,
  ROLE_IT,
  ROLE_USER,
} from "./permissions.ts";

test("Admin thấy tất cả menu", () => {
  assert.equal(canAccessMenu(ROLE_ADMIN, "dashboard"), true);
  assert.equal(canAccessMenu(ROLE_ADMIN, "assets"), true);
  assert.equal(canAccessMenu(ROLE_ADMIN, "models"), true);
  assert.equal(canAccessMenu(ROLE_ADMIN, "supplies"), true);
  assert.equal(canAccessMenu(ROLE_ADMIN, "employees"), true);
  assert.equal(canAccessMenu(ROLE_ADMIN, "users"), true);
  assert.equal(canAccessMenu(ROLE_ADMIN, "settings"), true);
});

test("IT không thấy Quản lý tài khoản và Cài đặt, nhưng xem được Model Library", () => {
  assert.equal(canAccessMenu(ROLE_IT, "users"), false);
  assert.equal(canAccessMenu(ROLE_IT, "settings"), false);
  assert.equal(canAccessMenu(ROLE_IT, "models"), true);
});

test("IT vẫn thấy dashboard, assets, supplies, employees", () => {
  assert.equal(canAccessMenu(ROLE_IT, "dashboard"), true);
  assert.equal(canAccessMenu(ROLE_IT, "assets"), true);
  assert.equal(canAccessMenu(ROLE_IT, "supplies"), true);
  assert.equal(canAccessMenu(ROLE_IT, "employees"), true);
});

test("User (viewer) xem được mọi menu trừ Quản lý tài khoản và Cài đặt", () => {
  assert.equal(canAccessMenu(ROLE_USER, "assets"), true);
  assert.equal(canAccessMenu(ROLE_USER, "supplies"), true);
  assert.equal(canAccessMenu(ROLE_USER, "employees"), true);
  assert.equal(canAccessMenu(ROLE_USER, "dashboard"), true);
  assert.equal(canAccessMenu(ROLE_USER, "models"), true);
  assert.equal(canAccessMenu(ROLE_USER, "reports"), true);

  assert.equal(canAccessMenu(ROLE_USER, "users"), false);
  assert.equal(canAccessMenu(ROLE_USER, "settings"), false);
});

test("canAccessMenu trả false cho role không tồn tại (không throw)", () => {
  assert.equal(canAccessMenu("KhongTonTai", "assets"), false);
});

test("canEditData chỉ đúng cho Admin và IT", () => {
  assert.equal(canEditData(ROLE_ADMIN), true);
  assert.equal(canEditData(ROLE_IT), true);
  assert.equal(canEditData(ROLE_USER), false);
  assert.equal(canEditData("KhongTonTai"), false);
});

test("getDefaultRouteForRole đá về '/' nếu vào được dashboard, ngược lại '/assets'", () => {
  assert.equal(getDefaultRouteForRole(ROLE_ADMIN), "/");
  assert.equal(getDefaultRouteForRole(ROLE_IT), "/");
  // Mọi role hiện đều vào được dashboard nên đều về "/"; role không tồn
  // tại (không vào được dashboard) rơi về /assets để tránh lặp redirect.
  assert.equal(getDefaultRouteForRole(ROLE_USER), "/");
  assert.equal(getDefaultRouteForRole("KhongTonTai"), "/assets");
});
