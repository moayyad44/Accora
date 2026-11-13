import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";
import { NAV_SECTIONS } from "@/app/nav-config";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const navButtonClass = (active: boolean) =>
  cn(
    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active ? "bg-primary-subtle text-primary" : "text-muted hover:bg-surface-sunken hover:text-foreground",
  );

export function Navbar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const location = useLocation();

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || hasPermission(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className={cn("flex items-center gap-1 overflow-x-auto", className)} aria-label={t("nav.dashboard")}>
      {visibleSections.map((section) => {
        if (section.items.length === 1) {
          const item = section.items[0];
          return (
            <NavLink key={item.path} to={item.path} end={item.path === "/"} className={({ isActive }) => navButtonClass(isActive)}>
              <item.icon className="size-4 shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          );
        }

        const isSectionActive = section.items.some((item) => location.pathname.startsWith(item.path));

        return (
          <DropdownMenu key={section.labelKey}>
            <DropdownMenuTrigger className={navButtonClass(isSectionActive)}>
              {t(section.labelKey)}
              <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {section.items.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn("flex items-center gap-2", isActive && "bg-primary-subtle text-primary")
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {t(item.labelKey)}
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
