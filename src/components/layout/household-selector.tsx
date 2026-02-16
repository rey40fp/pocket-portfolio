"use client";

import { useState } from "react";
import { ChevronsUpDown, Home, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Placeholder household selector dropdown.
 * In a future phase this will be wired to real household data
 * from the server via TanStack Query.
 */

interface Household {
  id: string;
  name: string;
}

const placeholderHouseholds: Household[] = [
  { id: "personal", name: "Personal" },
  { id: "family", name: "Smith Family" },
];

export function HouseholdSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Household>(placeholderHouseholds[0]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select household"
      >
        <Home className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">{selected.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Household
              </p>
            </div>
            <ul role="listbox" aria-label="Households">
              {placeholderHouseholds.map((household) => (
                <li key={household.id}>
                  <button
                    role="option"
                    aria-selected={selected.id === household.id}
                    onClick={() => {
                      setSelected(household);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                      selected.id === household.id && "font-medium",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5",
                        selected.id === household.id
                          ? "text-primary"
                          : "text-transparent",
                      )}
                    />
                    {household.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
