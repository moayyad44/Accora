import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={FileQuestion}
        title="الصفحة غير موجودة"
        description="الرابط الذي فتحته غير صحيح أو تم نقله."
        action={
          <Button asChild variant="outline">
            <Link to="/">{t("nav.dashboard")}</Link>
          </Button>
        }
      />
    </div>
  );
}
