"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger menu — visible on mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Household selector — wired up in Phase 1K */}
          </div>

          <div className="flex items-center gap-4">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                variables: {
                  colorPrimary: "hsl(142, 76%, 36%)",
                },
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 bg-muted/40 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
