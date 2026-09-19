-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_INVOICE', 'PURCHASE_RETURN', 'RECEIPT_VOUCHER', 'PAYMENT_VOUCHER', 'BANK_TRANSFER', 'BANK_RECONCILIATION', 'OPENING_BALANCE', 'CLOSING_ENTRY', 'RECURRING_ENTRY', 'DEPRECIATION', 'PAYROLL', 'PRODUCTION_ORDER', 'INVENTORY_ADJUSTMENT', 'CURRENCY_REVALUATION');

-- CreateEnum
CREATE TYPE "JournalPartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "InventoryValuationMethod" AS ENUM ('FIFO', 'WEIGHTED_AVERAGE');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AllocationBasis" AS ENUM ('PERCENTAGE', 'HEADCOUNT', 'ACTIVITY_HOURS');

-- CreateEnum
CREATE TYPE "CostVarianceType" AS ENUM ('MATERIAL', 'LABOR', 'OVERHEAD');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'FULLY_DEPRECIATED');

-- CreateEnum
CREATE TYPE "AssetTransactionType" AS ENUM ('DISPOSAL', 'TRANSFER', 'REVALUATION', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED');

-- CreateEnum
CREATE TYPE "PayrollItemType" AS ENUM ('BASIC', 'ALLOWANCE', 'DEDUCTION', 'OVERTIME', 'LOAN_REPAYMENT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'TRADING', 'SERVICE');

-- CreateEnum
CREATE TYPE "ItemTrackingType" AS ENUM ('NONE', 'SERIAL', 'BATCH');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('IN', 'OUT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateEnum
CREATE TYPE "StockMoveSourceType" AS ENUM ('SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_INVOICE', 'PURCHASE_RETURN', 'GOODS_RECEIPT', 'TRANSFER', 'STOCK_COUNT', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('IN_STOCK', 'SOLD', 'RETURNED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "StockCountType" AS ENUM ('PERIODIC', 'SURPRISE');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'POSTED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionStageStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PurchaseDocStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesDocStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('CASH', 'CREDIT');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" UUID,
    "accountType" "AccountType" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currencyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "accountId" UUID NOT NULL,

    CONSTRAINT "account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "periodId" UUID NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "sourceType" "JournalSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "description" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "reversalOfId" UUID,
    "createdById" UUID NOT NULL,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journalEntryId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "accountId" UUID NOT NULL,
    "costCenterId" UUID,
    "partyType" "JournalPartyType",
    "partyId" TEXT,
    "debit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currencyId" UUID,
    "exchangeRate" DECIMAL(18,6),
    "description" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_entry_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "templateLines" JSONB NOT NULL,
    "nextRunDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recurring_entry_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "legalName" TEXT,
    "taxNumber" TEXT,
    "logoUrl" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "symbol" TEXT NOT NULL,
    "minorUnit" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "baseCurrencyId" UUID NOT NULL,
    "inventoryValuationMethod" "InventoryValuationMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Amman',
    "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fullNameAr" TEXT,
    "phone" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_company_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_company_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_company_branches" (
    "userCompanyAccessId" UUID NOT NULL,
    "branchId" UUID NOT NULL,

    CONSTRAINT "user_company_branches_pkey" PRIMARY KEY ("userCompanyAccessId","branchId")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fiscalYearId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "currencyId" UUID NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "asOfDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "docType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "pattern" TEXT NOT NULL DEFAULT '{prefix}-{year}-{seq:6}',
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "resetPeriod" TEXT NOT NULL DEFAULT 'YEARLY',
    "lastResetAt" TIMESTAMP(3),

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "docType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflowId" UUID NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverRoleId" UUID,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflowId" UUID NOT NULL,
    "docType" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requestId" UUID NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_allocation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "basis" "AllocationBasis" NOT NULL DEFAULT 'PERCENTAGE',
    "sourceCostCenterId" UUID NOT NULL,
    "targetCostCenterId" UUID NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cost_allocation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_costs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "itemId" UUID NOT NULL,
    "materialCost" DECIMAL(18,4) NOT NULL,
    "laborCost" DECIMAL(18,4) NOT NULL,
    "overheadCost" DECIMAL(18,4) NOT NULL,
    "effectiveDate" DATE NOT NULL,

    CONSTRAINT "standard_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_variances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productionOrderId" UUID NOT NULL,
    "type" "CostVarianceType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "cost_variances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "defaultDepreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "defaultUsefulLifeMonths" INTEGER NOT NULL,
    "assetAccountId" UUID NOT NULL,
    "depreciationExpenseAccountId" UUID NOT NULL,
    "accumulatedDepreciationAccountId" UUID NOT NULL,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "categoryId" UUID NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "usageStartDate" DATE,
    "cost" DECIMAL(18,4) NOT NULL,
    "salvageValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "accumulated" DECIMAL(18,4) NOT NULL,
    "postedJournalEntryId" UUID,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "depreciation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" UUID NOT NULL,
    "type" "AssetTransactionType" NOT NULL,
    "transactionDate" DATE NOT NULL,
    "amount" DECIMAL(18,4),
    "notes" TEXT,
    "postedJournalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" UUID,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "departmentId" UUID,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "departmentId" UUID,
    "positionId" UUID,
    "employeeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fullNameAr" TEXT,
    "nationalId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "hireDate" DATE NOT NULL,
    "terminationDate" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "baseSalary" DECIMAL(18,4) NOT NULL,
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "runDate" DATE NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "postedJournalEntryId" UUID,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollRunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" "PayrollItemType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "costCenterId" UUID,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "overtimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "installments" INTEGER NOT NULL,
    "remainingBalance" DECIMAL(18,4) NOT NULL,
    "startDate" DATE NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouseId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" UUID,
    "defaultIncomeAccountId" UUID,
    "defaultCogsAccountId" UUID,
    "defaultInventoryAccountId" UUID,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "categoryId" UUID,
    "baseUnitId" UUID NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'TRADING',
    "trackingType" "ItemTrackingType" NOT NULL DEFAULT 'NONE',
    "minStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "maxStock" DECIMAL(18,4),
    "reorderPoint" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "valuationMethodOverride" "InventoryValuationMethod",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_unit_conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "itemId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "conversionFactor" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "item_unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_moves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "locationId" UUID,
    "batchId" UUID,
    "serialId" UUID,
    "moveType" "StockMoveType" NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "sourceType" "StockMoveSourceType" NOT NULL,
    "sourceId" TEXT,
    "moveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "companyId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "qtyOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("itemId","warehouseId")
);

-- CreateTable
CREATE TABLE "fifo_layers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qtyRemaining" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "sourceStockMoveId" UUID NOT NULL,

    CONSTRAINT "fifo_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "itemId" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufactureDate" DATE,
    "expiryDate" DATE,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "itemId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'IN_STOCK',

    CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "countNumber" TEXT NOT NULL,
    "countDate" DATE NOT NULL,
    "type" "StockCountType" NOT NULL DEFAULT 'PERIODIC',
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "postedJournalEntryId" UUID,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockCountId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "systemQty" DECIMAL(18,4) NOT NULL,
    "countedQty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bomId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "componentItemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitId" UUID NOT NULL,
    "scrapPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_centers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "costPerHour" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "bomId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "plannedQty" DECIMAL(18,4) NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE,
    "endDate" DATE,
    "postedJournalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productionOrderId" UUID NOT NULL,
    "workCenterId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "ProductionStageStatus" NOT NULL DEFAULT 'PENDING',
    "plannedHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "actualHours" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "production_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_consumptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productionOrderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_outputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productionOrderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "by_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productionOrderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "by_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "groupId" UUID,
    "creditLimit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
    "arAccountId" UUID,
    "taxNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
    "apAccountId" UUID,
    "taxNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "supplierId" UUID,
    "requestedById" UUID,
    "requestNumber" TEXT NOT NULL,
    "requestDate" DATE NOT NULL,
    "status" "PurchaseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseRequestId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "neededByDate" DATE,

    CONSTRAINT "purchase_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_rfqs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "rfqDate" DATE NOT NULL,
    "status" "PurchaseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,

    CONSTRAINT "purchase_rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_rfq_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rfqId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "quotedPrice" DECIMAL(18,4),
    "leadTimeDays" INTEGER,

    CONSTRAINT "purchase_rfq_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "supplierId" UUID NOT NULL,
    "rfqId" UUID,
    "poNumber" TEXT NOT NULL,
    "poDate" DATE NOT NULL,
    "expectedDate" DATE,
    "status" "PurchaseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyId" UUID NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "taxGroupId" UUID,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "supplierId" UUID NOT NULL,
    "purchaseOrderId" UUID,
    "warehouseId" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" DATE NOT NULL,
    "status" "PurchaseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "goodsReceiptId" UUID NOT NULL,
    "purchaseOrderLineId" UUID,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "supplierId" UUID NOT NULL,
    "purchaseOrderId" UUID,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "status" "PurchaseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyId" UUID NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "clearanceCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherCosts" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "postedJournalEntryId" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseInvoiceId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "warehouseId" UUID,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "taxGroupId" UUID,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "purchaseInvoiceId" UUID,
    "returnNumber" TEXT NOT NULL,
    "returnDate" DATE NOT NULL,
    "status" "PurchaseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "postedJournalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseReturnId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currencyId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "priceListId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("priceListId","itemId")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "quotationDate" DATE NOT NULL,
    "expiryDate" DATE,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyId" UUID NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotationId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxGroupId" UUID,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "customerId" UUID NOT NULL,
    "quotationId" UUID,
    "orderNumber" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyId" UUID NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "salesOrderId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxGroupId" UUID,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "customerId" UUID NOT NULL,
    "salesOrderId" UUID,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'CREDIT',
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyId" UUID NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "postedJournalEntryId" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "salesInvoiceId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "warehouseId" UUID,
    "salesRepId" UUID,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxGroupId" UUID,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "salesInvoiceId" UUID,
    "returnNumber" TEXT NOT NULL,
    "returnDate" DATE NOT NULL,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "postedJournalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "salesReturnId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,

    CONSTRAINT "tax_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "taxTypeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "payableAccountId" UUID NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_group_rates" (
    "taxGroupId" UUID NOT NULL,
    "taxRateId" UUID NOT NULL,

    CONSTRAINT "tax_group_rates_pkey" PRIMARY KEY ("taxGroupId","taxRateId")
);

-- CreateIndex
CREATE INDEX "accounts_companyId_parentId_idx" ON "accounts"("companyId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_companyId_code_key" ON "accounts"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_companyId_code_key" ON "cost_centers"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "account_mappings_companyId_key_key" ON "account_mappings"("companyId", "key");

-- CreateIndex
CREATE INDEX "journal_entries_companyId_sourceType_sourceId_idx" ON "journal_entries"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "journal_entries_companyId_periodId_idx" ON "journal_entries"("companyId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_companyId_entryNumber_key" ON "journal_entries"("companyId", "entryNumber");

-- CreateIndex
CREATE INDEX "journal_entry_lines_accountId_idx" ON "journal_entry_lines"("accountId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_partyType_partyId_idx" ON "journal_entry_lines"("partyType", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_lines_journalEntryId_lineNumber_key" ON "journal_entry_lines"("journalEntryId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_companyId_key" ON "company_settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_companyId_code_key" ON "branches"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_companyId_name_key" ON "roles"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_resource_action_key" ON "permissions"("module", "resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "user_company_access_userId_companyId_key" ON "user_company_access"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_companyId_name_key" ON "fiscal_years"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_fiscalYearId_name_key" ON "fiscal_periods"("fiscalYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_companyId_currencyId_asOfDate_key" ON "exchange_rates"("companyId", "currencyId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_companyId_branchId_docType_key" ON "document_sequences"("companyId", "branchId", "docType");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_entityType_entityId_idx" ON "audit_logs"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "attachments_companyId_entityType_entityId_idx" ON "attachments"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "notifications_companyId_userId_isRead_idx" ON "notifications"("companyId", "userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_workflowId_stepOrder_key" ON "approval_steps"("workflowId", "stepOrder");

-- CreateIndex
CREATE INDEX "approval_requests_docType_docId_idx" ON "approval_requests"("docType", "docId");

-- CreateIndex
CREATE UNIQUE INDEX "standard_costs_itemId_effectiveDate_key" ON "standard_costs"("itemId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_companyId_name_key" ON "asset_categories"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_assets_companyId_assetNumber_key" ON "fixed_assets"("companyId", "assetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_schedules_assetId_periodId_key" ON "depreciation_schedules"("assetId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_companyId_name_key" ON "departments"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "positions_companyId_title_key" ON "positions"("companyId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_employeeNumber_key" ON "employees"("companyId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_companyId_periodId_key" ON "payroll_runs"("companyId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employeeId_date_key" ON "attendance"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_companyId_code_key" ON "warehouses"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_warehouseId_code_key" ON "storage_locations"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_companyId_name_key" ON "item_categories"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_companyId_code_key" ON "units_of_measure"("companyId", "code");

-- CreateIndex
CREATE INDEX "items_companyId_barcode_idx" ON "items"("companyId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "items_companyId_sku_key" ON "items"("companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "item_unit_conversions_itemId_unitId_key" ON "item_unit_conversions"("itemId", "unitId");

-- CreateIndex
CREATE INDEX "stock_moves_companyId_itemId_warehouseId_idx" ON "stock_moves"("companyId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_moves_companyId_sourceType_sourceId_idx" ON "stock_moves"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "fifo_layers_companyId_itemId_warehouseId_receivedAt_idx" ON "fifo_layers"("companyId", "itemId", "warehouseId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "batches_itemId_batchNumber_key" ON "batches"("itemId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "serial_numbers_itemId_serialNumber_key" ON "serial_numbers"("itemId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_companyId_countNumber_key" ON "stock_counts"("companyId", "countNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_lines_stockCountId_itemId_key" ON "stock_count_lines"("stockCountId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "boms_companyId_itemId_version_key" ON "boms"("companyId", "itemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "bom_lines_bomId_lineNumber_key" ON "bom_lines"("bomId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_companyId_orderNumber_key" ON "production_orders"("companyId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "production_stages_productionOrderId_sequence_key" ON "production_stages"("productionOrderId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_companyId_name_key" ON "customer_groups"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_companyId_code_key" ON "customers"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_companyId_code_key" ON "suppliers"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_companyId_requestNumber_key" ON "purchase_requests"("companyId", "requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_request_lines_purchaseRequestId_lineNumber_key" ON "purchase_request_lines"("purchaseRequestId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_rfqs_companyId_rfqNumber_key" ON "purchase_rfqs"("companyId", "rfqNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_rfq_lines_rfqId_lineNumber_key" ON "purchase_rfq_lines"("rfqId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_companyId_poNumber_key" ON "purchase_orders"("companyId", "poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_purchaseOrderId_lineNumber_key" ON "purchase_order_lines"("purchaseOrderId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_companyId_receiptNumber_key" ON "goods_receipts"("companyId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_lines_goodsReceiptId_lineNumber_key" ON "goods_receipt_lines"("goodsReceiptId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_companyId_invoiceNumber_key" ON "purchase_invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoice_lines_purchaseInvoiceId_lineNumber_key" ON "purchase_invoice_lines"("purchaseInvoiceId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_companyId_returnNumber_key" ON "purchase_returns"("companyId", "returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_return_lines_purchaseReturnId_lineNumber_key" ON "purchase_return_lines"("purchaseReturnId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_companyId_name_key" ON "price_lists"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_companyId_quotationNumber_key" ON "quotations"("companyId", "quotationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_lines_quotationId_lineNumber_key" ON "quotation_lines"("quotationId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_companyId_orderNumber_key" ON "sales_orders"("companyId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_salesOrderId_lineNumber_key" ON "sales_order_lines"("salesOrderId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_companyId_invoiceNumber_key" ON "sales_invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_lines_salesInvoiceId_lineNumber_key" ON "sales_invoice_lines"("salesInvoiceId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_companyId_returnNumber_key" ON "sales_returns"("companyId", "returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_return_lines_salesReturnId_lineNumber_key" ON "sales_return_lines"("salesReturnId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tax_types_companyId_name_key" ON "tax_types"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tax_groups_companyId_name_key" ON "tax_groups"("companyId", "name");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_entry_templates" ADD CONSTRAINT "recurring_entry_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_access" ADD CONSTRAINT "user_company_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_access" ADD CONSTRAINT "user_company_access_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_access" ADD CONSTRAINT "user_company_access_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_branches" ADD CONSTRAINT "user_company_branches_userCompanyAccessId_fkey" FOREIGN KEY ("userCompanyAccessId") REFERENCES "user_company_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_branches" ADD CONSTRAINT "user_company_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocation_rules" ADD CONSTRAINT "cost_allocation_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocation_rules" ADD CONSTRAINT "cost_allocation_rules_sourceCostCenterId_fkey" FOREIGN KEY ("sourceCostCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocation_rules" ADD CONSTRAINT "cost_allocation_rules_targetCostCenterId_fkey" FOREIGN KEY ("targetCostCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standard_costs" ADD CONSTRAINT "standard_costs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_variances" ADD CONSTRAINT "cost_variances_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_depreciationExpenseAccountId_fkey" FOREIGN KEY ("depreciationExpenseAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_accumulatedDepreciationAccountId_fkey" FOREIGN KEY ("accumulatedDepreciationAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_schedules" ADD CONSTRAINT "depreciation_schedules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_schedules" ADD CONSTRAINT "depreciation_schedules_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_defaultIncomeAccountId_fkey" FOREIGN KEY ("defaultIncomeAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_defaultCogsAccountId_fkey" FOREIGN KEY ("defaultCogsAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_defaultInventoryAccountId_fkey" FOREIGN KEY ("defaultInventoryAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "serial_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_layers" ADD CONSTRAINT "fifo_layers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_layers" ADD CONSTRAINT "fifo_layers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_layers" ADD CONSTRAINT "fifo_layers_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_stages" ADD CONSTRAINT "production_stages_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_stages" ADD CONSTRAINT "production_stages_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "by_products" ADD CONSTRAINT "by_products_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "by_products" ADD CONSTRAINT "by_products_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "customer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_arAccountId_fkey" FOREIGN KEY ("arAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_apAccountId_fkey" FOREIGN KEY ("apAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_rfqs" ADD CONSTRAINT "purchase_rfqs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_rfqs" ADD CONSTRAINT "purchase_rfqs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_rfq_lines" ADD CONSTRAINT "purchase_rfq_lines_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "purchase_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_rfq_lines" ADD CONSTRAINT "purchase_rfq_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "purchase_rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_types" ADD CONSTRAINT "tax_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "tax_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_payableAccountId_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_groups" ADD CONSTRAINT "tax_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_group_rates" ADD CONSTRAINT "tax_group_rates_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_group_rates" ADD CONSTRAINT "tax_group_rates_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
