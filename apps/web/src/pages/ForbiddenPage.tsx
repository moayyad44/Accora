import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState icon={ShieldAlert} title={t("common.forbiddenTitle")} description={t("common.forbiddenBody")} />
    </div>
  );
}
