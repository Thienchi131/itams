import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWarehouseScope, scopeIncludesWarehouse } from "./warehouse-scope.ts";

const base = { regionWarehouseIds: null, customWarehouseIds: [], sharedWarehouseIds: [9] };

test("không gán gì = không giới hạn (null), không cộng kho dùng chung", () => {
  assert.equal(computeWarehouseScope({ warehouseId: null, ...base }), null);
});

test("warehouseId ưu tiên hơn Region, cộng kho dùng chung", () => {
  assert.deepEqual(
    computeWarehouseScope({ ...base, warehouseId: 3, regionWarehouseIds: [1, 2] }),
    [3, 9]
  );
});

test("Region + kho bổ sung + dùng chung", () => {
  assert.deepEqual(
    computeWarehouseScope({
      warehouseId: null,
      regionWarehouseIds: [1, 2],
      customWarehouseIds: [5],
      sharedWarehouseIds: [9],
    }),
    [1, 2, 5, 9]
  );
});

test("Region chưa có kho nào = mảng rỗng + dùng chung (không mở toang quyền)", () => {
  assert.deepEqual(
    computeWarehouseScope({ ...base, warehouseId: null, regionWarehouseIds: [] }),
    [9]
  );
});

test("chỉ có kho bổ sung", () => {
  assert.deepEqual(
    computeWarehouseScope({ ...base, warehouseId: null, customWarehouseIds: [4, 5] }),
    [4, 5, 9]
  );
});

test("scopeIncludesWarehouse", () => {
  assert.equal(scopeIncludesWarehouse(null, 1), true);
  assert.equal(scopeIncludesWarehouse(null, null), true);
  assert.equal(scopeIncludesWarehouse([1, 2], 2), true);
  assert.equal(scopeIncludesWarehouse([1, 2], 3), false);
  assert.equal(scopeIncludesWarehouse([1, 2], null), false);
});
