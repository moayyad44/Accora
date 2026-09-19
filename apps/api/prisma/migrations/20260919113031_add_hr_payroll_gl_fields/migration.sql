-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'EMPLOYEE_LOAN';

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "postedJournalEntryId" UUID;

-- AlterTable
ALTER TABLE "payroll_items" ADD COLUMN     "loanId" UUID,
ADD COLUMN     "note" TEXT;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
