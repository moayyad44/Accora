import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";
import { NAV_SECTIONS } from "@/app/nav-config";

export function Sidebar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || hasPermission(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className={cn("flex h-full flex-col gap-4 overflow-y-auto px-3 py-4", className)} aria-label={t("nav.dashboard")}>
      <div className="flex items-center gap-2 px-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-on-primary">
          أ
        </div>
        <span className="text-sm font-semibold text-foreground">{t("common.appName")}</span>
      </div>

      {visibleSections.map((section) => (
        <div key={section.labelKey}>
          {section.items.length > 1 && (
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              {t(section.labelKey)}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-subtle text-primary"
                        : "text-muted hover:bg-surface-sunken hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
