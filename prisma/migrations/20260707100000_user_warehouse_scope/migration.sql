-- Optional warehouse scope per user: NULL means "no restriction" (sees every
-- location, e.g. Admin). Used to limit dashboard/asset views to a single
-- local for scoped IT/User accounts.
ALTER TABLE "User" ADD COLUMN "warehouseId" INTEGER;

ALTER TABLE "User"
  ADD CONSTRAINT "User_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_warehouseId_idx" ON "User"("warehouseId");
