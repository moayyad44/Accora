import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  Rocket,
  BookText,
  Users,
  Truck,
  Package,
  Factory,
  Archive,
  Contact,
  Percent,
  Banknote,
  ShieldCheck,
  Cog,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const SECTION_KEYS = [
  { key: "gettingStarted", icon: Rocket },
  { key: "accounting", icon: BookText },
  { key: "sales", icon: Users },
  { key: "purchasing", icon: Truck },
  { key: "inventory", icon: Package },
  { key: "manufacturing", icon: Factory },
  { key: "fixedAssets", icon: Archive },
  { key: "hr", icon: Contact },
  { key: "tax", icon: Percent },
  { key: "banking", icon: Banknote },
  { key: "governance", icon: ShieldCheck },
  { key: "settings", icon: Cog },
] satisfies { key: string; icon: LucideIcon }[];

export function HelpPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t("help.title")} description={t("help.subtitle")} breadcrumbs={[{ label: t("help.title") }]} />

      <nav className="mb-6 flex flex-wrap gap-2" aria-label={t("help.tocTitle")}>
        {SECTION_KEYS.map(({ key }) => (
          <a
            key={key}
            href={`#help-${key}`}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {t(`help.sections.${key}.title`)}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-4">
        {SECTION_KEYS.map(({ key, icon: Icon }) => {
          const items = t(`help.sections.${key}.items`, { returnObjects: true }) as string[];
          return (
            <Card key={key} id={`help-${key}`} className="scroll-mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-4 text-muted" />
                  {t(`help.sections.${key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-foreground">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
