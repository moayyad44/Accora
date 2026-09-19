# Accora — Database Architecture (Phase 2)

> حالة المستند: **تم التنفيذ والتحقق فعليًا** على PostgreSQL 16 محلي (94 جدول أساسي + 4 جداول قوالب عامة = 98 جدول)، وليس مجرد تصميم نظري.

هذا المستند يشرح ما تم بناؤه في Phase 2: `schema.prisma` كامل، RLS، ضمان توازن القيود على مستوى قاعدة البيانات، والبيانات الأساسية (Seed).

---

## 1. أين الملفات

```
apps/api/
├── prisma/
│   ├── schema/                      # Multi-file Prisma schema (preview: prismaSchemaFolder)
│   │   ├── schema.prisma            # datasource + generator فقط
│   │   ├── core.prisma              # tenancy, users, roles, permissions, fiscal calendar, audit, approvals
│   │   ├── accounting.prisma        # chart of accounts, cost centers, journal entries/lines
│   │   ├── parties.prisma           # customers, suppliers
│   │   ├── sales.prisma             # quotations -> orders -> invoices -> returns
│   │   ├── purchasing.prisma        # requests -> RFQ -> PO -> receipt -> invoice -> return
│   │   ├── inventory.prisma         # warehouses, items, stock moves, FIFO layers, batches/serials
│   │   ├── manufacturing.prisma     # BOM, work centers, production orders
│   │   ├── costing.prisma           # cost allocation, standard costs, variances
│   │   ├── fixed-assets.prisma      # asset categories, assets, depreciation, transactions
│   │   ├── hr.prisma                # departments, employees, contracts, payroll, attendance
│   │   ├── tax.prisma                # tax types/rates/groups
│   │   └── templates.prisma         # GLOBAL (non-tenant) default CoA + role templates
│   ├── migrations/                  # applied, verified migrations (see §5)
│   └── seed.ts                      # seeds currencies, permissions, role & account templates
```

كل الموديولات موجودة كملفات Prisma منفصلة (Modular)، لكنها تُدمج بواسطة Prisma في schema واحد عند البناء — سهولة صيانة بدون فقدان التكامل.

---

## 2. قرارات تصميم أساسية

- **UUID كمفتاح أساسي**: `@default(dbgenerated("gen_random_uuid()"))` عبر extension `pgcrypto` (مُفعّل تلقائيًا في migration الأولى). أي جدول تشغيلي يستخدم هذا النمط.
- **المبالغ المالية**: `Decimal` في كل مكان (`@db.Decimal(18,4)` للمبالغ، `Decimal(18,6)` لأسعار الصرف) — **ولا حقل واحد Float** في كامل الـ schema.
- **أسماء الأعمدة**: Prisma بدون `@map` لكل حقل ينشئ أعمدة بنفس اسم الحقل (camelCase)، مثل `"companyId"` وليس `company_id`. هذا قرار واعٍ (ليس سهوًا) لتفادي إعادة تسمية آلاف الحقول يدويًا في Phase 2 — التطبيق بالكامل TypeScript/Prisma، وaccessing عبر Prisma Client لا يتأثر بهذا إطلاقًا. أي SQL خام يجب أن يستخدم الأسماء المقتبسة (`"companyId"`) كما هي موجودة فعليًا (تم التحقق بـ `\d` على كل جدول).
- **Soft delete**: لم يُضف عمود `deletedAt` بشكل شامل في Phase 2 — سيُضاف فقط للجداول التي تحتاجه فعليًا عند بناء منطق الحذف في الـ Phase المعنية (مثال: صنف يُستخدم بفاتورة قديمة لا يُحذف فيزيائيًا)، تفاديًا لإضافة أعمدة غير مستخدمة الآن.
- **لا حذف فيزيائي للمستندات المُرحّلة**: القيود المرحّلة (`JournalEntryStatus.POSTED`) لا تُحذف؛ فقط تُعكس بقيد `REVERSED` مرتبط بالأصلي (`reversalOfId`). هذا مفروض على مستوى منطق التطبيق في الـ Phase القادمة (المحرك)، والبنية هنا تدعمه بالكامل.

---

## 3. العزل بين الشركات (Multi-Tenant Isolation) — طبقتان مستقلتان

### الطبقة 1: فلترة على مستوى التطبيق
كل جدول تشغيلي يحمل `companyId` (باستثناء الجداول العامة الموضحة في §3.3). في الـ Phase القادمة (Auth)، سيُضاف Prisma Middleware/Extension يحقن `companyId` تلقائيًا في كل استعلام.

### الطبقة 2: PostgreSQL Row-Level Security (تم تفعيلها وتم اختبارها فعليًا)
Migration `20260919071703_add_row_level_security` تُفعّل RLS على **49 جدولًا** يحمل `companyId` مباشرة (عبر حلقة `DO $$ ... FOREACH ... $$` لتفادي التكرار)، بالإضافة إلى **7 جداول تفصيلية حساسة ماليًا** لا تحمل `companyId` مباشرة لكنها محمية عبر سياسة تتحقق من الشركة عبر الجدول الأب (`journal_entry_lines`, `sales_invoice_lines`, `purchase_invoice_lines`, `stock_count_lines`, `payroll_items`, `depreciation_schedules`, `asset_transactions`).

**الآلية:**
```sql
-- كل Request يبدأ Transaction بهذا:
SELECT set_config('app.current_company_id', '<company-uuid>', true); -- true = transaction-local

-- كل Policy تتحقق من:
USING ("companyId" = NULLIF(current_setting('app.current_company_id', true), '')::uuid)
```
**إذا لم يُحدَّد `app.current_company_id` (تم نسيانه في الكود)، `current_setting` ترجع NULL، والمقارنة `NULL = anything` ترجع NULL (ليست TRUE) → **السياسة ترفض كل الصفوف افتراضيًا** (Fail-Closed). هذا يعني: خطأ برمجي في الكود = صفر بيانات، وليس تسريب بيانات.

الجداول محمية بـ `FORCE ROW LEVEL SECURITY` أيضًا، أي حتى مستخدم قاعدة البيانات المالك للجدول (`postgres`) يخضع للسياسة عند الاتصال كدور `app_user` (الدور الذي أنشأته الـ migration وسيكون هو الدور الوحيد الذي يتصل به الـ backend في الإنتاج).

**تم التحقق فعليًا** (وليس فقط بالتصميم) بتشغيل سيناريو: إنشاء شركتين، تفعيل `app.current_company_id` على شركة A، ثم محاولة قراءة بيانات شركة B — النتيجة صفر صفوف. تبديل السياق لشركة B أظهر بياناتها فقط. راجع سجل الجلسة إن أردت إعادة الاختبار يدويًا (`SET ROLE app_user; SELECT set_config(...); SELECT * FROM branches;`).

### 3.3 الجداول غير المحمية بـ RLS (بقرار واعٍ)
- **`companies`**: هي جذر الـ tenant نفسه؛ التحكم بمن يرى أي شركة يتم عبر `user_company_access`، ليس RLS.
- **`currencies`, `permissions`, `users`, `account_templates`, `account_template_lines`, `role_templates`, `role_template_permissions`**: كتالوجات عامة (Global) بالتصميم — العملة "دينار أردني" ليست ملكًا لشركة معينة، والمستخدم قد يعمل بعدة شركات.
- **جداول الأسطر/الربط النقية** (مثال: `quotation_lines`, `sales_order_lines`, `bom_lines`, `tax_group_rates`, `contracts`, `attendance`, ...) — لا تُقرأ أبدًا بشكل مستقل في كود التطبيق، فقط عبر الجدول الأب الذي هو أصلًا محمي (وread فقط يحدث after فلترة الأب)، ومحمية بـ `ON DELETE CASCADE` من الأب. هذا حد واضح موثّق للنطاق في Phase 2 — إن ظهرت حاجة لاستعلام مباشر على أحد هذه الجداول لاحقًا (تقرير أداء مثلاً)، تُضاف له سياسة Join مشابهة لما طُبّق على `journal_entry_lines`.

---

## 4. ضمان توازن القيد المحاسبي — على مستوى قاعدة البيانات وليس فقط الكود

بالإضافة لـ `CHECK` بسيط (كل سطر إما مدين أو دائن، ليس كلاهما، وليس صفر):
```sql
ADD CONSTRAINT journal_entry_line_single_sided
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0));
```
تم إضافة **Deferred Constraint Trigger** يتحقق عند `COMMIT` (وليس عند كل `INSERT`، لأن قيدًا محاسبيًا يُبنى بعدة أسطر واحدًا تلو الآخر) أن `SUM(debit) = SUM(credit)` لكل `journalEntryId` تم لمسه في المعاملة، ويرفض المعاملة كاملة (`ROLLBACK`) إن لم تكن متوازنة.

**تم اختباره فعليًا**: محاولة `COMMIT` لقيد بسطرين (100 مدين / 50 دائن) رفضتها قاعدة البيانات بالخطأ:
```
ERROR: Unbalanced journal entry ...: debit 100.0000 <> credit 50.0000
```
بينما قيد متوازن (100/100) نجح. هذا يعني: **حتى لو كان هناك خطأ في PostingEngine مستقبلًا، قاعدة البيانات نفسها الخط الدفاعي الأخير الذي يمنع فعليًا وجود قيد غير متوازن.**

---

## 5. القوالب العامة والـ Seed

بما أن دليل الحسابات (`Account`) والأدوار (`Role`) مرتبطة بشركة معيّنة (لضمان قابلية كل شركة لتعديلها لاحقًا بحرية)، لا يوجد "دليل حسابات افتراضي" جاهز يُستخدم مباشرة — بدلًا من ذلك أضفنا طبقة **قوالب عامة (Global Templates)** غير مرتبطة بأي شركة:

- `AccountTemplate` + `AccountTemplateLine`: قالب "Standard Template" بـ **58 حساب** (أصول، التزامات، حقوق ملكية، إيرادات، مصروفات — يغطي شركات تجارية وصناعية: مخزون مواد خام/تحت التشغيل/تام الصنع، تكلفة بضاعة مباعة تجاري وصناعي، تكاليف صناعية غير مباشرة...). عند إنشاء شركة جديدة (Phase 3)، تُستنسخ هذه الأسطر إلى جدول `Account` الخاص بالشركة، وتصبح قابلة للتعديل الكامل من تلك اللحظة.
- `RoleTemplate` + `RoleTemplatePermission`: **10 أدوار قياسية** (مدير النظام، كبير المحاسبين، محاسب، مبيعات، مشتريات، أمين مستودع، إنتاج، موارد بشرية، مدير، مدقق) — كل دور مربوط تلقائيًا بمجموعة صلاحيات منطقية من كتالوج الصلاحيات (مثال: "مدقق" يحصل تلقائيًا على صلاحيات View/Print/Export فقط من كل الموديولات).
- `Permission`: كتالوج شامل **347 صلاحية** (module × resource × action) يغطي كل الموديولات: core, accounting, sales, purchasing, inventory, manufacturing, fixed_assets, hr, tax.
- `Currency`: 6 عملات أساسية (JOD, USD, EUR, SAR, AED, EGP) — قابل للتوسع بسهولة.

**تشغيل الـ Seed (تم اختباره فعليًا، بما فيها إعادة التشغيل idempotent):**
```bash
cd apps/api
pnpm prisma:seed
```

---

## 6. تشغيل قاعدة البيانات محليًا

```bash
# 1. تأكد من وجود PostgreSQL 16+ يعمل محليًا (أو عبر Docker لاحقًا)
createdb accora_dev
createdb accora_shadow   # لازمة لـ prisma migrate dev فقط، وليست جزءًا من التطبيق

# 2. انسخ apps/api/.env.example إلى apps/api/.env وعدّل DATABASE_URL عند الحاجة

# 3. من جذر المشروع
pnpm install
pnpm --filter @accora/api prisma:migrate   # يطبق كل الـ migrations بالترتيب
pnpm --filter @accora/api prisma:seed      # يزرع البيانات العامة
```

تم التحقق أن هذا التسلسل الكامل يعمل من الصفر على PostgreSQL 16 نظيف وينتج **98 جدولًا** بدون أي خطأ.

---

## 7. ماذا لم يُبنَ بعد (بقصد — هذا نطاق Phase 3+)

- لا يوجد كود NestJS فعلي بعد (`apps/api/src` فارغ) — فقط طبقة قاعدة البيانات. الـ `PostingEngine`, الـ Guards, الـ Auth، إلخ هي Phase 3/4.
- لا يوجد منطق لاستنساخ القوالب العامة إلى شركة جديدة بعد — هذا أول شيء يُبنى في Phase 3 عند إنشاء الشركة.
- الـ `app_user` الذي أنشأته migration الـ RLS بكلمة مرور مؤقتة (`change_me_in_production`) — يجب تغييرها عبر متغير بيئة قبل أي نشر حقيقي؛ هذا مذكور بوضوح داخل تعليق الـ migration نفسها.

---

**الخطوة التالية**: Phase 3 — Auth + Users + Companies + Roles + Permissions (تفعيل استخدام هذه القاعدة فعليًا من كود التطبيق، بما فيه حقن `app.current_company_id` تلقائيًا في كل معاملة، واستنساخ القوالب عند إنشاء شركة جديدة).
