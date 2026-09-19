-- CreateTable
CREATE TABLE "account_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "account_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_template_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentCode" TEXT,
    "accountType" "AccountType" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "isHeader" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "account_template_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,

    CONSTRAINT "role_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_template_permissions" (
    "roleTemplateId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_template_permissions_pkey" PRIMARY KEY ("roleTemplateId","permissionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_templates_name_key" ON "account_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "account_template_lines_templateId_code_key" ON "account_template_lines"("templateId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "role_templates_name_key" ON "role_templates"("name");

-- AddForeignKey
ALTER TABLE "account_template_lines" ADD CONSTRAINT "account_template_lines_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "account_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_template_permissions" ADD CONSTRAINT "role_template_permissions_roleTemplateId_fkey" FOREIGN KEY ("roleTemplateId") REFERENCES "role_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_template_permissions" ADD CONSTRAINT "role_template_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
