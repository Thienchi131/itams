-- Merge any duplicate "Dubai"-ish warehouses into the canonical "DXB - Dubai"
-- row created by prisma/seed.ts, reassigning every reference before deleting
-- the duplicates. Safe to run even if there is 0, 1, or several duplicates.
DO $$
DECLARE
  new_id INTEGER;
  dup RECORD;
BEGIN
  SELECT id INTO new_id FROM "Warehouse" WHERE name = 'DXB - Dubai';

  IF new_id IS NOT NULL THEN
    FOR dup IN
      SELECT id FROM "Warehouse"
      WHERE id <> new_id AND name ILIKE '%dubai%'
    LOOP
      UPDATE "Asset" SET "warehouseId" = new_id WHERE "warehouseId" = dup.id;
      UPDATE "StockInSlip" SET "warehouseId" = new_id WHERE "warehouseId" = dup.id;
      UPDATE "AssetHistory" SET "fromWarehouseId" = new_id WHERE "fromWarehouseId" = dup.id;
      UPDATE "AssetHistory" SET "toWarehouseId" = new_id WHERE "toWarehouseId" = dup.id;

      DELETE FROM "Warehouse" WHERE id = dup.id;
    END LOOP;
  END IF;
END $$;

-- Add the new `code` column (nullable until backfilled below).
ALTER TABLE "Warehouse" ADD COLUMN "code" TEXT;

-- Backfill code/name for rows following the "<CODE> - <Country>" pattern
-- used by prisma/seed.ts (e.g. "DXB - Dubai" -> code "DXB", name "Dubai").
UPDATE "Warehouse"
SET
  "code" = split_part(name, ' - ', 1),
  "name" = split_part(name, ' - ', 2)
WHERE name LIKE '% - %';

-- Fallback: derive a code from the name for any remaining warehouse (e.g.
-- rows created earlier via the free-text stock-in form), de-duplicated by
-- row order in case two names start with the same 3 letters.
WITH ranked AS (
  SELECT
    id,
    upper(left(regexp_replace(name, '[^A-Za-z0-9]', '', 'g'), 3)) AS base_code,
    row_number() OVER (
      PARTITION BY upper(left(regexp_replace(name, '[^A-Za-z0-9]', '', 'g'), 3))
      ORDER BY id
    ) AS rn
  FROM "Warehouse"
  WHERE "code" IS NULL
)
UPDATE "Warehouse" w
SET "code" = ranked.base_code || CASE WHEN ranked.rn = 1 THEN '' ELSE ranked.rn::text END
FROM ranked
WHERE w.id = ranked.id;

-- Drop the old `location` column and the unique constraint on `name` (name
-- is no longer unique on its own; `code` takes over that role).
ALTER TABLE "Warehouse" DROP COLUMN "location";
ALTER TABLE "Warehouse" DROP CONSTRAINT IF EXISTS "Warehouse_name_key";

-- Enforce the new uniqueness + not-null on code.
ALTER TABLE "Warehouse" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_code_key" UNIQUE ("code");
