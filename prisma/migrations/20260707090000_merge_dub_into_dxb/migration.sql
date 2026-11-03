-- Follow-up cleanup: the previous migration's merge step ran before
-- `npm run seed` had created the canonical "DXB - Dubai" row, so any
-- pre-existing Dubai warehouse got auto-assigned a fallback code (e.g. "DUB")
-- instead of being merged. This finishes the job: merge every remaining
-- "Dubai"-ish warehouse that isn't code DXB into the DXB row, then delete it.
DO $$
DECLARE
  target_id INTEGER;
  dup RECORD;
BEGIN
  SELECT id INTO target_id FROM "Warehouse" WHERE code = 'DXB';

  IF target_id IS NOT NULL THEN
    FOR dup IN
      SELECT id FROM "Warehouse"
      WHERE id <> target_id AND (code ILIKE '%dub%' OR name ILIKE '%dubai%')
    LOOP
      UPDATE "Asset" SET "warehouseId" = target_id WHERE "warehouseId" = dup.id;
      UPDATE "StockInSlip" SET "warehouseId" = target_id WHERE "warehouseId" = dup.id;
      UPDATE "AssetHistory" SET "fromWarehouseId" = target_id WHERE "fromWarehouseId" = dup.id;
      UPDATE "AssetHistory" SET "toWarehouseId" = target_id WHERE "toWarehouseId" = dup.id;

      DELETE FROM "Warehouse" WHERE id = dup.id;
    END LOOP;
  END IF;
END $$;
