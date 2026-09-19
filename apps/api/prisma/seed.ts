/**
 * Phase 2 seed: global, non-tenant reference data only.
 *   - Currency catalog
 *   - Permission catalog (module.resource.action)
 *   - Standard role templates (cloned into a company's own Role rows when
 *     the company is created — see docs/ARCHITECTURE.md §6)
 *   - Default chart-of-accounts template (cloned into a company's own
 *     Account rows when the company is created, then freely editable)
 *
 * No Company/Branch/User rows are created here — a tenant only exists once
 * someone actually signs up (Phase 3: Auth + Companies).
 */
import { AccountType, NormalBalance, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STANDARD_ACTIONS = ["view", "create", "update", "delete"] as const;
const DOCUMENT_ACTIONS = [...STANDARD_ACTIONS, "post", "approve", "print", "export"] as const;
const READ_ONLY_ACTIONS = ["view", "print", "export"] as const;

type ActionSet = readonly string[];

interface ModulePermissions {
  module: string;
  resources: { resource: string; actions?: ActionSet }[];
  defaultActions: ActionSet;
}

const PERMISSION_CATALOG: ModulePermissions[] = [
  {
    module: "core",
    defaultActions: STANDARD_ACTIONS,
    resources: [
      { resource: "company" },
      { resource: "branch" },
      { resource: "user" },
      { resource: "role" },
      { resource: "fiscal_period", actions: [...STANDARD_ACTIONS, "close"] },
      { resource: "document_sequence" },
      { resource: "approval_workflow" },
      { resource: "audit_log", actions: READ_ONLY_ACTIONS },
      { resource: "notification", actions: ["view"] },
      { resource: "attachment", actions: ["view", "create", "delete"] },
    ],
  },
  {
    module: "accounting",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "chart_of_accounts" },
      { resource: "cost_center" },
      { resource: "journal_entry" },
      { resource: "recurring_entry" },
      { resource: "account_mapping" },
      { resource: "financial_report", actions: READ_ONLY_ACTIONS },
    ],
  },
  {
    module: "sales",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "customer" },
      { resource: "quotation" },
      { resource: "sales_order" },
      { resource: "sales_invoice" },
      { resource: "sales_return" },
      { resource: "price_list" },
      { resource: "sales_report", actions: READ_ONLY_ACTIONS },
    ],
  },
  {
    module: "purchasing",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "supplier" },
      { resource: "purchase_request" },
      { resource: "rfq" },
      { resource: "purchase_order" },
      { resource: "goods_receipt" },
      { resource: "purchase_invoice" },
      { resource: "purchase_return" },
      { resource: "purchasing_report", actions: READ_ONLY_ACTIONS },
    ],
  },
  {
    module: "inventory",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "warehouse" },
      { resource: "item" },
      { resource: "stock_transfer" },
      { resource: "stock_count" },
      { resource: "stock_adjustment" },
      { resource: "inventory_report", actions: READ_ONLY_ACTIONS },
    ],
  },
  {
    module: "manufacturing",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "bom" },
      { resource: "work_center" },
      { resource: "standard_cost" },
      { resource: "production_order" },
      { resource: "production_report", actions: READ_ONLY_ACTIONS },
    ],
  },
  {
    module: "fixed_assets",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "asset_category" },
      { resource: "fixed_asset" },
      { resource: "depreciation_run" },
    ],
  },
  {
    module: "hr",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "employee" },
      { resource: "department" },
      { resource: "contract" },
      { resource: "attendance" },
      { resource: "leave" },
      { resource: "loan" },
      { resource: "payroll_run" },
    ],
  },
  {
    module: "tax",
    defaultActions: STANDARD_ACTIONS,
    resources: [{ resource: "tax_type" }, { resource: "tax_group" }],
  },
  {
    module: "banking",
    defaultActions: DOCUMENT_ACTIONS,
    resources: [
      { resource: "cash_bank_account" },
      { resource: "receipt_voucher" },
      { resource: "payment_voucher" },
      { resource: "bank_transfer" },
      { resource: "bank_reconciliation" },
    ],
  },
];

const ROLE_TEMPLATES: { name: string; nameAr: string; description: string; modules: string[] | "*" }[] = [
  { name: "Company Admin", nameAr: "مدير النظام", description: "Full access within the company", modules: "*" },
  {
    name: "Chief Accountant",
    nameAr: "كبير المحاسبين",
    description: "Full accounting + approval authority",
    modules: ["accounting", "tax", "core"],
  },
  {
    name: "Accountant",
    nameAr: "محاسب",
    description: "Day-to-day bookkeeping, no approval/close rights",
    modules: ["accounting"],
  },
  { name: "Sales", nameAr: "مبيعات", description: "Sales cycle: quotations to invoices", modules: ["sales"] },
  { name: "Purchases", nameAr: "مشتريات", description: "Purchasing cycle: requests to invoices", modules: ["purchasing"] },
  { name: "Warehouse", nameAr: "أمين مستودع", description: "Inventory operations", modules: ["inventory"] },
  { name: "Production", nameAr: "إنتاج", description: "Manufacturing operations", modules: ["manufacturing"] },
  { name: "HR", nameAr: "موارد بشرية", description: "Employee & payroll administration", modules: ["hr"] },
  { name: "Manager", nameAr: "مدير", description: "Cross-module read access + approvals", modules: "*" },
  { name: "Auditor", nameAr: "مدقق", description: "Read-only access everywhere", modules: "*" },
];

const CURRENCIES = [
  { code: "JOD", name: "Jordanian Dinar", nameAr: "دينار أردني", symbol: "د.أ", minorUnit: 3 },
  { code: "USD", name: "US Dollar", nameAr: "دولار أمريكي", symbol: "$", minorUnit: 2 },
  { code: "EUR", name: "Euro", nameAr: "يورو", symbol: "€", minorUnit: 2 },
  { code: "SAR", name: "Saudi Riyal", nameAr: "ريال سعودي", symbol: "ر.س", minorUnit: 2 },
  { code: "AED", name: "UAE Dirham", nameAr: "درهم إماراتي", symbol: "د.إ", minorUnit: 2 },
  { code: "EGP", name: "Egyptian Pound", nameAr: "جنيه مصري", symbol: "ج.م", minorUnit: 2 },
];

// code, name, nameAr, parentCode, type, normalBalance, isHeader
const DEFAULT_COA: [string, string, string, string | null, AccountType, NormalBalance, boolean][] = [
  ["1000", "Assets", "الأصول", null, "ASSET", "DEBIT", true],
  ["1100", "Current Assets", "الأصول المتداولة", "1000", "ASSET", "DEBIT", true],
  ["1110", "Cash", "النقدية", "1100", "ASSET", "DEBIT", true],
  ["1111", "Cash on Hand", "الصندوق", "1110", "ASSET", "DEBIT", false],
  ["1112", "Petty Cash", "صندوق المصروفات النثرية", "1110", "ASSET", "DEBIT", false],
  ["1120", "Banks", "البنوك", "1100", "ASSET", "DEBIT", true],
  ["1121", "Bank Current Account", "حساب بنكي جاري", "1120", "ASSET", "DEBIT", false],
  ["1130", "Accounts Receivable", "ذمم مدينة", "1100", "ASSET", "DEBIT", true],
  ["1131", "Trade Receivables", "ذمم العملاء", "1130", "ASSET", "DEBIT", false],
  ["1132", "Allowance for Doubtful Accounts", "مخصص ديون مشكوك بتحصيلها", "1130", "ASSET", "CREDIT", false],
  ["1140", "Inventory", "المخزون", "1100", "ASSET", "DEBIT", true],
  ["1141", "Raw Materials Inventory", "مخزون المواد الخام", "1140", "ASSET", "DEBIT", false],
  ["1142", "Work In Process Inventory", "مخزون تحت التشغيل", "1140", "ASSET", "DEBIT", false],
  ["1143", "Finished Goods Inventory", "مخزون تام الصنع", "1140", "ASSET", "DEBIT", false],
  ["1144", "Trading Goods Inventory", "مخزون بضاعة تجارية", "1140", "ASSET", "DEBIT", false],
  ["1150", "Prepaid Expenses", "مصروفات مدفوعة مقدمًا", "1100", "ASSET", "DEBIT", false],
  ["1160", "Employee Loans Receivable", "قروض موظفين", "1100", "ASSET", "DEBIT", false],
  ["1200", "Fixed Assets", "الأصول الثابتة", "1000", "ASSET", "DEBIT", true],
  ["1210", "Land", "أراضي", "1200", "ASSET", "DEBIT", false],
  ["1220", "Buildings", "مباني", "1200", "ASSET", "DEBIT", false],
  ["1230", "Machinery & Equipment", "آلات ومعدات", "1200", "ASSET", "DEBIT", false],
  ["1240", "Furniture & Fixtures", "أثاث وتجهيزات", "1200", "ASSET", "DEBIT", false],
  ["1250", "Vehicles", "مركبات", "1200", "ASSET", "DEBIT", false],
  ["1260", "Accumulated Depreciation", "مجمع الإهلاك", "1200", "ASSET", "CREDIT", false],

  ["2000", "Liabilities", "الالتزامات", null, "LIABILITY", "CREDIT", true],
  ["2100", "Current Liabilities", "الالتزامات المتداولة", "2000", "LIABILITY", "CREDIT", true],
  ["2110", "Accounts Payable", "ذمم دائنة", "2100", "LIABILITY", "CREDIT", true],
  ["2111", "Trade Payables", "ذمم الموردين", "2110", "LIABILITY", "CREDIT", false],
  ["2120", "Tax Payable", "ضرائب مستحقة الدفع", "2100", "LIABILITY", "CREDIT", false],
  ["2130", "Accrued Expenses", "مصروفات مستحقة", "2100", "LIABILITY", "CREDIT", false],
  ["2140", "Salaries Payable", "رواتب مستحقة الدفع", "2100", "LIABILITY", "CREDIT", false],
  ["2150", "Payroll Deductions Payable", "استقطاعات رواتب مستحقة", "2100", "LIABILITY", "CREDIT", false],
  ["2200", "Long-term Liabilities", "الالتزامات طويلة الأجل", "2000", "LIABILITY", "CREDIT", true],
  ["2210", "Long-term Loans", "قروض طويلة الأجل", "2200", "LIABILITY", "CREDIT", false],

  ["3000", "Equity", "حقوق الملكية", null, "EQUITY", "CREDIT", true],
  ["3100", "Share Capital", "رأس المال", "3000", "EQUITY", "CREDIT", false],
  ["3200", "Retained Earnings", "الأرباح المحتجزة", "3000", "EQUITY", "CREDIT", false],
  ["3300", "Current Year Earnings", "أرباح السنة الحالية", "3000", "EQUITY", "CREDIT", false],

  ["4000", "Revenue", "الإيرادات", null, "REVENUE", "CREDIT", true],
  ["4100", "Sales Revenue", "إيرادات المبيعات", "4000", "REVENUE", "CREDIT", false],
  ["4200", "Sales Returns & Allowances", "مردودات ومسموحات المبيعات", "4000", "REVENUE", "DEBIT", false],
  ["4300", "Other Income", "إيرادات أخرى", "4000", "REVENUE", "CREDIT", false],

  ["5000", "Expenses", "المصروفات", null, "EXPENSE", "DEBIT", true],
  ["5100", "Cost of Goods Sold", "تكلفة البضاعة المباعة", "5000", "EXPENSE", "DEBIT", true],
  ["5110", "COGS - Trading", "تكلفة البضاعة المباعة - تجاري", "5100", "EXPENSE", "DEBIT", false],
  ["5120", "COGS - Manufacturing", "تكلفة البضاعة المباعة - صناعي", "5100", "EXPENSE", "DEBIT", false],
  ["5200", "Direct Labor", "أجور مباشرة", "5000", "EXPENSE", "DEBIT", false],
  ["5300", "Manufacturing Overhead", "التكاليف الصناعية غير المباشرة", "5000", "EXPENSE", "DEBIT", true],
  ["5310", "Indirect Materials", "مواد غير مباشرة", "5300", "EXPENSE", "DEBIT", false],
  ["5320", "Indirect Labor", "أجور غير مباشرة", "5300", "EXPENSE", "DEBIT", false],
  ["5330", "Factory Overhead Applied", "تكاليف صناعية محملة", "5300", "EXPENSE", "DEBIT", false],
  ["5400", "Operating Expenses", "مصروفات تشغيلية", "5000", "EXPENSE", "DEBIT", true],
  ["5410", "Salaries & Wages", "رواتب وأجور", "5400", "EXPENSE", "DEBIT", false],
  ["5420", "Rent Expense", "مصروف إيجار", "5400", "EXPENSE", "DEBIT", false],
  ["5430", "Utilities Expense", "مصروف مرافق", "5400", "EXPENSE", "DEBIT", false],
  ["5440", "Depreciation Expense", "مصروف إهلاك", "5400", "EXPENSE", "DEBIT", false],
  ["5450", "Office Supplies", "مستلزمات مكتبية", "5400", "EXPENSE", "DEBIT", false],
  ["5460", "Marketing & Advertising", "تسويق وإعلان", "5400", "EXPENSE", "DEBIT", false],
  ["5470", "Bank Charges", "عمولات بنكية", "5400", "EXPENSE", "DEBIT", false],
  ["5480", "Inventory Adjustments", "تسويات المخزون", "5400", "EXPENSE", "DEBIT", false],
  ["5490", "Gain/Loss on Asset Disposal", "أرباح وخسائر استبعاد الأصول", "5400", "EXPENSE", "DEBIT", false],
  ["5500", "Currency Exchange Loss/Gain", "أرباح وخسائر فروقات عملة", "5000", "EXPENSE", "DEBIT", false],
];

async function seedCurrencies() {
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({ where: { code: c.code }, update: c, create: c });
  }
  console.log(`Seeded ${CURRENCIES.length} currencies`);
}

async function seedPermissions() {
  let count = 0;
  for (const mod of PERMISSION_CATALOG) {
    for (const res of mod.resources) {
      const actions = res.actions ?? mod.defaultActions;
      for (const action of actions) {
        await prisma.permission.upsert({
          where: { module_resource_action: { module: mod.module, resource: res.resource, action } },
          update: {},
          create: { module: mod.module, resource: res.resource, action },
        });
        count++;
      }
    }
  }
  console.log(`Seeded ${count} permissions`);
}

async function seedRoleTemplates() {
  const allPermissions = await prisma.permission.findMany();

  for (const rt of ROLE_TEMPLATES) {
    const template = await prisma.roleTemplate.upsert({
      where: { name: rt.name },
      update: { nameAr: rt.nameAr, description: rt.description },
      create: { name: rt.name, nameAr: rt.nameAr, description: rt.description },
    });

    const relevant =
      rt.modules === "*"
        ? allPermissions
        : allPermissions.filter((p) => rt.modules.includes(p.module));

    // Auditor is read-only everywhere regardless of module scope.
    const grantable =
      rt.name === "Auditor" ? relevant.filter((p) => READ_ONLY_ACTIONS.includes(p.action as any)) : relevant;

    await prisma.roleTemplatePermission.deleteMany({ where: { roleTemplateId: template.id } });
    if (grantable.length > 0) {
      await prisma.roleTemplatePermission.createMany({
        data: grantable.map((p) => ({ roleTemplateId: template.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`Seeded ${ROLE_TEMPLATES.length} role templates`);
}

async function seedAccountTemplate() {
  const template = await prisma.accountTemplate.upsert({
    where: { name: "Standard Template" },
    update: { description: "Generic trading + manufacturing default chart of accounts" },
    create: { name: "Standard Template", description: "Generic trading + manufacturing default chart of accounts" },
  });

  await prisma.accountTemplateLine.deleteMany({ where: { templateId: template.id } });
  await prisma.accountTemplateLine.createMany({
    data: DEFAULT_COA.map(([code, name, nameAr, parentCode, accountType, normalBalance, isHeader]) => ({
      templateId: template.id,
      code,
      name,
      nameAr,
      parentCode,
      accountType,
      normalBalance,
      isHeader,
    })),
  });
  console.log(`Seeded default chart-of-accounts template with ${DEFAULT_COA.length} lines`);
}

async function main() {
  await seedCurrencies();
  await seedPermissions();
  await seedRoleTemplates();
  await seedAccountTemplate();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
