import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidWhitelistEntry, ipMatchesEntry } from "./ip-whitelist.ts";

test("isValidWhitelistEntry chấp nhận IPv4 đơn hợp lệ", () => {
  assert.equal(isValidWhitelistEntry("1.2.3.4").valid, true);
  assert.equal(isValidWhitelistEntry("255.255.255.255").valid, true);
  assert.equal(isValidWhitelistEntry("0.0.0.0").valid, true);
});

test("isValidWhitelistEntry từ chối IPv4 sai định dạng", () => {
  assert.equal(isValidWhitelistEntry("999.1.1.1").valid, false);
  assert.equal(isValidWhitelistEntry("1.2.3").valid, false);
  assert.equal(isValidWhitelistEntry("1.2.3.4.5").valid, false);
  assert.equal(isValidWhitelistEntry("not-an-ip").valid, false);
});

test("isValidWhitelistEntry từ chối chuỗi rỗng kèm thông báo lỗi", () => {
  const result = isValidWhitelistEntry("   ");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("isValidWhitelistEntry chấp nhận CIDR IPv4 hợp lệ", () => {
  assert.equal(isValidWhitelistEntry("192.168.1.0/24").valid, true);
  assert.equal(isValidWhitelistEntry("10.0.0.0/8").valid, true);
  assert.equal(isValidWhitelistEntry("1.2.3.4/32").valid, true);
  assert.equal(isValidWhitelistEntry("0.0.0.0/0").valid, true);
});

test("isValidWhitelistEntry từ chối CIDR có prefix ngoài 0-32", () => {
  assert.equal(isValidWhitelistEntry("1.2.3.0/33").valid, false);
  assert.equal(isValidWhitelistEntry("1.2.3.0/-1").valid, false);
});

test("isValidWhitelistEntry từ chối CIDR với phần base không phải IPv4", () => {
  assert.equal(isValidWhitelistEntry("abc/24").valid, false);
});

test("isValidWhitelistEntry chấp nhận IPv6 đơn giản (so khớp chuỗi, không CIDR)", () => {
  assert.equal(isValidWhitelistEntry("2001:db8::1").valid, true);
  assert.equal(isValidWhitelistEntry("::1").valid, true);
});

test("ipMatchesEntry so khớp chính xác khi entry là 1 IP đơn", () => {
  assert.equal(ipMatchesEntry("10.0.0.1", "10.0.0.1"), true);
  assert.equal(ipMatchesEntry("10.0.0.2", "10.0.0.1"), false);
});

test("ipMatchesEntry so khớp đúng theo dải CIDR", () => {
  assert.equal(ipMatchesEntry("192.168.1.5", "192.168.1.0/24"), true);
  assert.equal(ipMatchesEntry("192.168.1.255", "192.168.1.0/24"), true);
  assert.equal(ipMatchesEntry("192.168.2.5", "192.168.1.0/24"), false);
});

test("ipMatchesEntry /32 chỉ khớp đúng 1 IP", () => {
  assert.equal(ipMatchesEntry("1.2.3.4", "1.2.3.4/32"), true);
  assert.equal(ipMatchesEntry("1.2.3.5", "1.2.3.4/32"), false);
});

test("ipMatchesEntry /0 khớp với mọi IPv4", () => {
  assert.equal(ipMatchesEntry("8.8.8.8", "0.0.0.0/0"), true);
  assert.equal(ipMatchesEntry("1.1.1.1", "0.0.0.0/0"), true);
});
