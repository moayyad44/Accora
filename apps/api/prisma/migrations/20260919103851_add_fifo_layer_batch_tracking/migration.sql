-- AlterTable
ALTER TABLE "fifo_layers" ADD COLUMN     "batchId" UUID;

-- AddForeignKey
ALTER TABLE "fifo_layers" ADD CONSTRAINT "fifo_layers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
