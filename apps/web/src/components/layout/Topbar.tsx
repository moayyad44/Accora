import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Building2, Check, ChevronDown, HelpCircle, Languages, LogOut, Menu, Moon, Sun, SunMoon, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/features/theme/theme-context";
import { authApi } from "@/api/auth";
import { useToast } from "@/components/ui/toast";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { t, i18n } = useTranslation();
  const { user, logout, switchCompany } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: authApi.myCompanies,
    staleTime: 5 * 60_000,
  });

  const currentCompany = companiesQuery.data?.find((c) => c.companyId === user?.companyId);

  const handleSwitchCompany = async (companyId: string) => {
    if (companyId === user?.companyId) return;
    try {
      await switchCompany(companyId);
    } catch {
      toast({ title: t("common.errorTitle"), description: t("common.errorGeneric"), variant: "error" });
    }
  };

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="size-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-56">
              <Building2 className="size-4 text-muted" />
              <span className="truncate">{currentCompany?.companyName ?? "—"}</span>
              <ChevronDown className="size-3.5 text-subtle" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{t("auth.switchCompany")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {companiesQuery.data?.map((c) => (
              <DropdownMenuItem key={c.companyId} onClick={() => handleSwitchCompany(c.companyId)}>
                {c.companyId === user?.companyId && <Check className="size-4" />}
                <span className="truncate">{c.companyName}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" aria-label={t("help.title")} asChild>
          <Link to="/help">
            <HelpCircle className="size-4.5" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("common.search")}>
              <Languages className="size-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => i18n.changeLanguage("ar")}>
              {i18n.language === "ar" && <Check className="size-4" />} العربية
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => i18n.changeLanguage("en")}>
              {i18n.language === "en" && <Check className="size-4" />} English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              {theme === "light" && <Sun className="size-4.5" />}
              {theme === "dark" && <Moon className="size-4.5" />}
              {theme === "system" && <SunMoon className="size-4.5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              {theme === "light" && <Check className="size-4" />} <Sun className="size-4" /> فاتح
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              {theme === "dark" && <Check className="size-4" />} <Moon className="size-4" /> داكن
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              {theme === "system" && <Check className="size-4" />} <SunMoon className="size-4" /> حسب النظام
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-secondary-subtle">
                <User className="size-3.5 text-muted" />
              </span>
              <span className="hidden max-w-32 truncate sm:inline">{user?.fullName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate font-medium text-foreground">{user?.fullName}</p>
              <p className="truncate text-xs font-normal text-subtle">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={logout}>
              <LogOut className="size-4" />
              {t("auth.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
