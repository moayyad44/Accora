# Accora — Architecture Proposal (Phase 1)

> حالة المستند: **مسودة للمراجعة** — لا يبدأ التنفيذ الفعلي (Phase 3+) قبل الموافقة على هذا المستند.
> النطاق: ERP محاسبي متعدد الشركات (Multi-Company) يعمل كـ Web Application، قابل للتوسع لاحقًا إلى SaaS.

---

## 1. ملخص تنفيذي

Accora نظام ERP محاسبي حقيقي، جوهره (Core) هو **محرك محاسبة بقيد مزدوج (Double-Entry Posting Engine)** تمر من خلاله كل حركة مالية من أي موديول (مبيعات، مشتريات، مخزون، تصنيع، رواتب، أصول ثابتة...). الموديولات لا "تكتب" في الحسابات مباشرة؛ هي تطلب من المحرك ترحيل حركة، والمحرك هو من يضمن التوازن، فتح الفترة، صحة الحسابات، والتتبع الكامل (Traceability).

النظام Multi-Tenant بعزل بيانات صارم على مستوى الصف (`company_id` + PostgreSQL Row-Level Security)، مع صلاحيات RBAC دقيقة على مستوى (شركة → فرع → موديول → شاشة → عملية).

---

## 2. Technology Stack

| الطبقة | الاختيار | السبب |
|---|---|---|
| Backend Framework | **NestJS (Node.js + TypeScript)** | بنية Modular جاهزة (Modules/Providers/Guards/Interceptors)، DI قوي، مناسب جدًا لأنظمة enterprise كبيرة ومقسّمة، دعم OpenAPI تلقائي |
| Database | **PostgreSQL 16** | ACID كامل، Row-Level Security، JSONB، Window Functions للتقارير المالية، نضج وموثوقية |
| ORM | **Prisma** (+ raw SQL/transactions عند الحاجة للترحيل المحاسبي) | Type-safety كامل بين DB والكود، Migrations واضحة، سهولة الصيانة |
| Cache / Queue | **Redis + BullMQ** | قيود متكررة، إهلاك شهري تلقائي، إشعارات، تصدير تقارير كبيرة، إعادة تقييم عملات |
| Auth | **JWT (access + refresh) + httpOnly cookies، Argon2 لتشفير كلمات المرور** | آمن، Stateless للـ API، قابل للاستخدام من Web/Mobile مستقبلًا |
| Permissions | **RBAC مخصص (Roles × Permissions) + Guards على مستوى Route** | مرونة كاملة بدل الاعتماد على مكتبة جاهزة مقيدة |
| Frontend Framework | **React 18 + TypeScript + Vite** | أداء عالي، نضج، سهولة التوظيف |
| UI Layer | **Tailwind CSS + shadcn/ui (Radix)** | تحكم كامل بالتصميم، دعم RTL طبيعي عبر Logical CSS Properties |
| Data Fetching/State | **TanStack Query** (server state) + **Zustand** (UI/local state) | فصل واضح بين حالة الخادم والواجهة، أداء أفضل من Redux لهذا النوع من التطبيقات |
| Jadwal/Tables | **TanStack Table** | جداول احترافية: Sort/Filter/Pagination/Virtualization |
| Forms/Validation | **React Hook Form + Zod** (نفس Zod schemas تُشارك مع Backend عبر حزمة مشتركة) | تقليل التكرار، اتساق التحقق بين الواجهة والخادم |
| i18n | **i18next** (عربي أساسي RTL، إنجليزي جاهز) | دعم فعلي وليس ترجمة سطحية |
| API Style | **REST + OpenAPI/Swagger** (إصدار v1)، بنية جاهزة لإضافة GraphQL لاحقًا عند الحاجة لتكاملات معقدة | REST أبسط للتحقق والأمان في نظام مالي، وأسهل استهلاكًا لموبايل/تكاملات خارجية |
| File Storage | **واجهة تخزين مجردة (Storage Adapter)**: MinIO/S3-compatible في الإنتاج، Local disk في التطوير | لا اعتماد مباشر على مزوّد سحابي معيّن |
| Testing | **Jest** (Unit/Integration) + **Supertest** (API) + **Playwright** (E2E لاحقًا) | تغطية طبقات النظام المختلفة |
| Monorepo | **pnpm workspaces + Turborepo** | مشاركة الأنواع (types) وSchemas بين `api` و`web` بدون تكرار |
| Containerization | **Docker + docker-compose** (dev)، صورة إنتاج منفصلة لكل خدمة | بيئة متسقة، جاهزية للنشر |

---

## 3. Multi-Company / Multi-Tenant Architecture

**القرار: Shared Database, Shared Schema, Row-Level Isolation** (وليس قاعدة بيانات منفصلة لكل شركة، وليس Schema منفصل).

**السبب:**
- أسهل بالصيانة والترحيلات (migration واحدة تخدم الجميع).
- أداء ممتاز حتى آلاف الشركات مع Indexing صحيح على `company_id`.
- التوسع لاحقًا إلى SaaS حقيقي أبسط (يمكن لاحقًا فصل الشركات الكبيرة جدًا إلى قاعدة بيانات مستقلة كـ "escape hatch" دون تغيير معمارية التطبيق، لأن كل استعلام أصلًا مبني على tenant context).

**آلية العزل (دفاع متعدد الطبقات):**
1. **طبقة التطبيق**: كل Query يمر عبر Prisma Middleware/Extension يحقن `company_id` تلقائيًا اعتمادًا على الـ Tenant Context الحالي (من الـ JWT + الشركة النشطة المختارة). لا يوجد استعلام "خام" بدون فلترة.
2. **طبقة قاعدة البيانات (دفاع ثانٍ حقيقي وليس شكلي)**: PostgreSQL **Row-Level Security (RLS)** على كل جدول يحوي `company_id`، عبر `SET app.current_company_id` في بداية كل معاملة (transaction). حتى لو حدث خطأ برمجي في طبقة التطبيق، قاعدة البيانات نفسها ترفض إرجاع صفوف شركة أخرى.
3. **الشركة النشطة**: يختارها المستخدم من الواجهة (Company Switcher)، تُحفظ في الجلسة، وتُتحقق في كل Request أن للمستخدم صلاحية وصول فعلية لهذه الشركة عبر جدول `user_company_access`.

**بنية الجداول الأساسية:**
```
companies (tenant root)
company_settings (عملة، سنة مالية، طريقة تقييم مخزون، ...)
branches (company_id FK)
users (عام - مستخدم قد يعمل بعدة شركات)
user_company_access (user_id, company_id, role_id, branch_scope[])
```
كل الجداول التشغيلية (accounts, invoices, items, journal_entries...) تحمل `company_id NOT NULL` + Index مركّب `(company_id, ...)`.

---

## 4. Database Architecture — المبادئ العامة

- **Foreign Keys صارمة** بين كل الجداول المترابطة، بدون حذف فيزيائي للسجلات المالية (Soft Delete فقط عبر `deleted_at`، والمستندات المُرحّلة posted لا تُحذف إطلاقًا — فقط تُعكس بقيد عكسي/إشعار دائن).
- **UUID** كمفتاح أساسي (v7 - قابل للترتيب زمنيًا) لتفادي تعارضات multi-tenant وتسهيل sharding مستقبلي.
- **DB Constraints حقيقية** وليست فقط تحقق في الكود: مثال `CHECK` على أن `journal_entry_lines` كل سطر إما مدين أو دائن (وليس الاثنين معًا)، Trigger يتحقق عند إقفال المعاملة (`COMMIT` عبر `DEFERRABLE CONSTRAINT`) أن `SUM(debit) = SUM(credit)` لكل `journal_entry_id`.
- **كل عملية محاسبية داخل DB Transaction واحدة** (ACID) — فشل أي جزء = تراجع كامل.
- **Audit تلقائي**: عمود `created_by/updated_by/created_at/updated_at` + جدول `audit_logs` منفصل (before/after JSON diff) يُملأ عبر Interceptor مركزي في NestJS، ليس يدويًا في كل موديول.
- **الترقيم (Numbering)**: جدول `document_sequences(company_id, branch_id, doc_type, prefix, pattern, current_number, reset_period)` مع قفل صف (`SELECT ... FOR UPDATE`) عند توليد الرقم التالي لمنع التكرار تحت التزامن.

### مخطط الوحدات الأساسية (مختصر، ستفصّل بالكامل في Phase 2)

```
Core:        companies, branches, users, roles, permissions, user_company_access,
             company_settings, currencies, exchange_rates, fiscal_years, fiscal_periods,
             document_sequences, audit_logs, attachments, notifications, approval_workflows

Accounting:  accounts (CoA, self-referencing tree), cost_centers, journal_entries,
             journal_entry_lines, recurring_entry_templates, account_mappings

Parties:     customers, suppliers, customer_groups, credit_terms

Sales:       quotations, sales_orders, sales_invoices, sales_invoice_lines,
             sales_returns, price_lists, price_list_items

Purchasing:  purchase_requests, rfqs, purchase_orders, goods_receipts,
             purchase_invoices, purchase_returns

Inventory:   warehouses, storage_locations, items, item_categories, units_of_measure,
             item_unit_conversions, stock_moves, stock_balances (per warehouse/lot),
             stock_counts, serial_numbers, batches

Manufacturing: boms, bom_lines, work_centers, production_orders, production_stages,
             material_consumptions, production_outputs, by_products

Costing:     cost_centers (shared with Accounting), cost_allocation_rules,
             standard_costs, cost_variances

Fixed Assets: asset_categories, fixed_assets, depreciation_schedules,
             asset_transactions (disposal/transfer/revaluation)

HR:          employees, departments, positions, contracts, payroll_runs,
             payroll_items, attendance, leaves, loans

Tax:         tax_types, tax_rates, tax_groups, tax_accounts

Documents:   attachments (polymorphic: entity_type, entity_id)
```

---

## 5. Accounting Engine Design (جوهر النظام)

### المبدأ
موديول واحد فقط يملك صلاحية الكتابة في `journal_entries` / `journal_entry_lines`: **`PostingEngine`**. أي موديول آخر (مبيعات، مخزون، رواتب...) لا يكتب قيدًا مباشرة؛ يبني **`PostingRequest`** ويرسله للمحرك.

### مثال تدفق: ترحيل فاتورة مبيعات آجلة مع أثر مخزون
```
SalesInvoiceService.post(invoiceId)
  → يبدأ DB Transaction
  → يتحقق: الفترة المالية مفتوحة، المستند غير مُرحّل مسبقًا، صلاحية المستخدم بالترحيل
  → يبني PostingRequest بخطين على الأقل:
        DR  Accounts Receivable (من account_mappings الخاصة بالشركة)     مبلغ الفاتورة شامل الضريبة
        CR  Sales Revenue (من تصنيف الصنف/الحساب الافتراضي)              المبلغ قبل الضريبة
        CR  Tax Payable (إن وجدت ضريبة)                                  قيمة الضريبة
  → InventoryService.consumeStock(items, method=FIFO/WeightedAvg حسب إعداد الشركة)
        DR  COGS                                                          التكلفة الفعلية
        CR  Inventory                                                      نفس القيمة
  → PostingEngine.post([...lines])
        - يتحقق SUM(debit) == SUM(credit) بدقة عشرية (Decimal, ليس Float إطلاقًا)
        - يتحقق أن كل حساب Active وليس Header-only account
        - يولّد journal_entry برقم تسلسلي ومرجع للمستند المصدر (source_type, source_id)
        - Commit
  → SalesInvoiceService يُحدّث حالة الفاتورة إلى Posted (غير قابلة للتعديل، فقط عكس/إشعار دائن)
```

### قواعد صارمة يفرضها المحرك
- **لا يوجد قيد غير متوازن أبدًا** (يُرفض على مستوى الكود + Constraint على مستوى DB كطبقة حماية أخيرة).
- **لا ترحيل على فترة مالية مغلقة.**
- **لا حذف لقيد مُرحّل** — فقط "Reversing Entry" يُنشئ قيد عكسي مرتبط بالأصلي.
- **الحسابات الافتراضية قابلة للتهيئة لكل شركة** عبر `account_mappings` (مثال: `default_ar_account`, `default_ap_account`, `default_cogs_account`, `default_inventory_account`, `default_tax_payable_account`...) — **لا شيء hardcoded**.
- **مراكز التكلفة والفروع** حقول اختيارية على كل `journal_entry_line` لدعم التقارير حسب الفرع/المركز.

### دفاتر مشتقة (Read Models) لا تُكتب يدويًا
- **دفتر الأستاذ العام/المساعد، ميزان المراجعة، قائمة الدخل، الميزانية العمومية** — كلها Views/Queries محسوبة من `journal_entry_lines` مباشرة (مصدر حقيقة واحد Single Source of Truth)، وليست جداول منفصلة قد تفقد التزامن مع القيود.
- تقارير أعمار الديون وكشوف الحسابات تُبنى من نفس القيود + جداول Sub-ledger مرتبطة بـ `source_type/source_id` للسرعة، لكنها تُراجع دوريًا (reconciliation job) للتأكد من تطابقها مع GL.

---

## 6. Permission Architecture (RBAC)

- **Role** معرّف على مستوى الشركة (كل شركة قد تخصص أدوارًا مختلفة انطلاقًا من أدوار قياسية جاهزة).
- **Permission** = `(module, resource, action)` — مثال: `sales.invoice.post`, `accounting.journal.approve`, `hr.payroll.view`.
- **Actions القياسية لكل شاشة**: `view, create, update, delete, post (ترحيل), approve (اعتماد), print, export`.
- **النطاق (Scope)**: صلاحية قد تكون على مستوى الشركة كاملة أو مقيدة بفروع محددة (`branch_scope` في `user_company_access`).
- **التطبيق**: `PermissionGuard` في NestJS يقرأ الـ Permission المطلوب من Decorator على كل Endpoint (`@RequirePermission('sales.invoice.post')`) ويتحقق من صلاحيات المستخدم بسياق الشركة/الفرع الحاليين قبل تنفيذ أي منطق.
- **Super Admin** فوق كل الشركات (لإدارة النظام نفسه، غير مرتبط بشركة واحدة) — منفصل تمامًا عن أدوار الشركات.

## 7. Approval Workflow

- جدول `approval_workflows(company_id, doc_type, conditions JSONB, steps[])` — الشروط تدعم المبلغ، الفرع، نوع المستند.
- جدول `approval_requests(document_type, document_id, current_step, status)` + `approval_actions(step, user_id, decision, comment, acted_at)`.
- المستند لا يمكن ترحيله (`post`) إلا بعد اكتمال كل خطوات الموافقة المطلوبة — يتحقق منها `PostingEngine` قبل القبول.

---

## 8. API Architecture

- `REST`, نسخة مُصدّرة: `/api/v1/...`
- كل موديول = NestJS Module مستقل (Controller + Service + DTOs) — لا اعتماد دائري بين الموديولات؛ التواصل بين الموديولات عبر Services/Events داخلية فقط (مثال: `InventoryModule` يستمع لحدث `SalesInvoicePosted` عبر Event Emitter داخلي بدل استدعاء مباشر متشابك).
- **Validation**: DTOs بـ `class-validator` + Zod schemas مشتركة مع الواجهة عبر حزمة `packages/shared`.
- **Error Handling**: Exception Filter مركزي يُرجع شكل خطأ موحّد (`{code, message, details}`)، لا تسريب لتفاصيل داخلية.
- **Pagination/Filtering/Sorting**: معيار موحّد لكل الـ Endpoints (`?page=&pageSize=&sort=&filter[field]=`).
- **Logging**: Structured logging (pino) + ربط كل Request بمعرف تتبع (`requestId`) يظهر في الأخطاء والـ Audit Log.
- **Rate Limiting**: على مستوى Gateway (NestJS Throttler) خاصة لـ Auth endpoints.
- **API Docs**: Swagger تلقائي من الـ Decorators، جاهز لاستهلاك مستقبلي من تطبيق موبايل أو تكاملات خارجية.

---

## 9. Folder Structure (Monorepo)

```
accora/
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── src/
│   │   │   ├── core/              # auth, companies, users, roles, permissions, fiscal-periods
│   │   │   ├── accounting/        # chart-of-accounts, journal-entries, posting-engine
│   │   │   ├── parties/           # customers, suppliers
│   │   │   ├── sales/
│   │   │   ├── purchasing/
│   │   │   ├── inventory/
│   │   │   ├── manufacturing/
│   │   │   ├── costing/
│   │   │   ├── fixed-assets/
│   │   │   ├── hr/
│   │   │   ├── tax/
│   │   │   ├── reports/
│   │   │   ├── notifications/
│   │   │   ├── documents/
│   │   │   ├── audit/
│   │   │   ├── common/            # guards, interceptors, decorators, filters, pipes
│   │   │   └── main.ts
│   │   ├── prisma/                # schema.prisma + migrations
│   │   └── test/
│   └── web/                       # React frontend
│       ├── src/
│       │   ├── app/                # routing, layout, providers
│       │   ├── features/           # يقابل موديولات الـ backend (sales/, inventory/...)
│       │   ├── components/ui/      # shadcn components
│       │   ├── lib/                # api client, query hooks
│       │   └── i18n/
│       └── ...
├── packages/
│   ├── shared-types/               # DTO/Entity types مشتركة
│   ├── shared-schemas/             # Zod validation schemas مشتركة
│   └── config/                     # eslint/tsconfig مشتركة
├── docs/
│   ├── ARCHITECTURE.md             # هذا المستند
│   └── modules/                    # مستند تفصيلي لكل موديول عند بدء تنفيذه
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## 10. Development Roadmap (13 Phases — كما طُلب)

| Phase | المخرجات | معيار "جاهز" (Definition of Done) |
|---|---|---|
| 1 | هذا المستند + موافقة | موافقتك على المعمارية |
| 2 | `schema.prisma` كامل + migrations أولية | قاعدة بيانات تُنشأ بنجاح، RLS مفعّل، علاقات صحيحة |
| 3 | Auth + Users + Companies + Roles + Permissions | تسجيل دخول، تبديل شركة، Guard يمنع وصول غير مصرح، اختبارات عزل شركات تمر |
| 4 | Accounting Core (CoA + Journal Entries + Posting Engine) | لا يمكن إنشاء قيد غير متوازن، اختبارات Posting Engine تمر |
| 5 | Customers + Suppliers + Sales + Purchases | فاتورة مبيعات/شراء تُرحّل وتُنشئ قيدًا صحيحًا تلقائيًا |
| 6 | Inventory + Warehouses | حركة صنف صحيحة، تقييم FIFO/Weighted Average يعمل، فاتورة تُخفّض المخزون فعليًا |
| 7 | Manufacturing + Cost Accounting | أمر إنتاج يستهلك مواد خام وينتج تام الصنع بتكلفة محسوبة صحيحة |
| 8 | Fixed Assets | إهلاك تلقائي شهري ينشئ قيدًا صحيحًا |
| 9 | HR + Payroll | مسير رواتب ينشئ قيد رواتب موزّع على مراكز التكلفة |
| 10 | Reports + Dashboard | ميزان المراجعة/قائمة الدخل/الميزانية تُطابق القيود يدويًا (تحقق تصالحي) |
| 11 | Audit + Notifications + Documents | كل عملية حساسة مسجّلة بـ before/after |
| 12 | Testing + Security + Performance | تغطية اختبارات كافية للمسارات المحاسبية الحرجة، فحص أمني أساسي |
| 13 | Deployment + Backup + Production Readiness | نشر يعمل، نسخ احتياطي مجدول ومُختبر استعادته فعليًا |

**قاعدة العمل:** لا ننتقل لمرحلة تالية قبل أن تعمل اختبارات المرحلة الحالية وتُعرض عليك النتيجة.

---

## 11. قرارات معمارية مهمة تحتاج قرارك الصريح

اخترت الحل الأكثر قابلية للتوسع لكل نقطة، لكن أذكرها هنا للشفافية — أخبرني إن كنت تريد تغيير أي منها:

1. **REST بدل GraphQL** — أبسط للتحقق والأمان في نظام مالي، ويكفي تمامًا لموبايل/تكاملات مستقبلية. *(يمكن إضافة GraphQL Gateway لاحقًا فوق نفس الـ Services دون إعادة بناء).*
2. **Shared DB + RLS بدل DB منفصلة لكل شركة** — أسهل صيانة، ويمكن "الهروب" لاحقًا لقاعدة بيانات مستقلة لشركة ضخمة معينة دون تغيير المعمارية.
3. **Prisma كـ ORM** مع اللجوء لـ Raw SQL/Transactions الصريحة فقط في `PostingEngine` حيث الدقة والتحكم الكامل ضروريان.
4. **لا Microservices الآن** — Modular Monolith داخل NestJS (موديولات مفصولة بوضوح لكن Deployment واحد). التقسيم لخدمات مستقلة قرار لاحق إذا استدعت الحاجة فعليًا (Vertical Scaling يكفي لسنوات طويلة لهذا النوع من الأنظمة). أسهل بالتطوير والصيانة الآن، ومعمارية الموديولات تسمح بالفصل لاحقًا بأقل ضرر.
5. **رقم عشري (Decimal) وليس Float** لكل المبالغ المالية في DB والكود (Prisma `Decimal` + مكتبة `decimal.js` في الحسابات) — لمنع أخطاء التقريب.

---

## 12. الخطوة التالية

بانتظار موافقتك على هذا المستند (أو تعديلاتك عليه)، ثم أبدأ **Phase 2: Database Schema الكامل** (`schema.prisma` + العلاقات + RLS policies + seed بيانات أساسية مثل دليل حسابات افتراضي قابل للتعديل).
