import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

export interface NavItem {
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** Permission required to see this item — omit for items everyone with
   * an active company can see (e.g. Dashboard). Checked against
   * useAuth().hasPermission, which is itself sourced from the real
   * permission list on GET /users/me — nothing here is decorative: an
   * item only appears once its page actually exists AND the account has
   * the permission the backend would also enforce. */
  permission?: string;
}

export interface NavSection {
  labelKey: string;
  items: NavItem[];
}

/** Grows one module at a time as each module's real pages are wired to
 * the real API — never add an item here for a page that doesn't exist
 * yet (see the project's "no mock UI" rule). */
export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "nav.dashboard",
    items: [{ path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
];
