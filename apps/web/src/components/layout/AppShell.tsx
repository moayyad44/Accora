import * as React from "react";
import { Outlet } from "react-router-dom";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar className="hidden w-64 shrink-0 border-e border-border lg:flex" />

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 bg-surface shadow-xl">
            <button
              className="absolute end-2 top-2 rounded-md p-1.5 text-subtle hover:bg-surface-sunken"
              onClick={() => setMobileOpen(false)}
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
            <Sidebar className="w-72" />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
