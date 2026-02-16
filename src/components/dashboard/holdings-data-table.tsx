"use client";

import * as React from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  X,
  List,
  Layers,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatPercent, formatShares, cn } from "@/lib/utils";
import { ASSET_TYPES, type AssetType } from "@/lib/constants";
import type { HoldingRow } from "@/server/dal/holdings";

// ─── Sort Header Helper ──────────────────────────────────────────────

interface SortableHeaderProps {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void };
  children: React.ReactNode;
  className?: string;
}

function SortableHeader({ column, children, className }: SortableHeaderProps) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8 data-[state=open]:bg-accent", className)}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      <Icon className="ml-1 h-3.5 w-3.5" />
    </Button>
  );
}

// ─── Gain/Loss Cell Helper ──────────────────────────────────────────

function GainLossCell({ cents, percent }: { cents: number; percent?: number }) {
  const isGain = cents > 0;
  const isLoss = cents < 0;
  const TrendIcon = isGain ? TrendingUp : isLoss ? TrendingDown : Minus;
  const trendColor = isGain ? "text-gain" : isLoss ? "text-loss" : "text-muted-foreground";

  return (
    <div className="flex items-center justify-end gap-1">
      <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
      <span className={cn("tabular-nums font-medium", trendColor)}>
        {formatCurrency(cents, { showSign: true })}
      </span>
      {percent !== undefined && (
        <span className={cn("text-xs", trendColor)}>
          ({formatPercent(percent, { showSign: true })})
        </span>
      )}
    </div>
  );
}

// ─── Column Definitions ──────────────────────────────────────────────

const columns: ColumnDef<HoldingRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column}>Name / Ticker</SortableHeader>,
    cell: ({ row }) => {
      const { ticker, name, id } = row.original;
      return (
        <Link href={`/holdings/${id}`} className="group block">
          <div className="flex flex-col">
            {ticker && (
              <span className="font-semibold text-foreground group-hover:text-primary">
                {ticker}
              </span>
            )}
            <span className={cn(
              "text-muted-foreground",
              ticker ? "text-xs" : "font-medium text-foreground group-hover:text-primary",
            )}>
              {name}
            </span>
          </div>
        </Link>
      );
    },
    filterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const { name, ticker } = row.original;
      return (
        name.toLowerCase().includes(search) ||
        (ticker?.toLowerCase().includes(search) ?? false)
      );
    },
  },
  {
    accessorKey: "assetTypeLabel",
    header: ({ column }) => <SortableHeader column={column}>Asset Type</SortableHeader>,
    cell: ({ row }) => (
      <Badge variant="secondary" className="rounded-md font-normal">
        {row.original.assetTypeLabel}
      </Badge>
    ),
    filterFn: (row, _columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      return filterValue.includes(row.original.assetType);
    },
  },
  {
    accessorKey: "shares",
    header: ({ column }) => (
      <SortableHeader column={column} className="justify-end">Shares</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-foreground">
        {row.original.shares > 0 ? formatShares(row.original.shares) : "—"}
      </div>
    ),
  },
  {
    accessorKey: "avgCostCents",
    header: ({ column }) => (
      <SortableHeader column={column} className="justify-end">Avg Cost</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-foreground">
        {row.original.avgCostCents > 0
          ? formatCurrency(row.original.avgCostCents)
          : "—"}
      </div>
    ),
  },
  {
    accessorKey: "currentPriceCents",
    header: ({ column }) => (
      <SortableHeader column={column} className="justify-end">Current Price</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-foreground">
        {row.original.currentPriceCents > 0
          ? formatCurrency(row.original.currentPriceCents)
          : "—"}
      </div>
    ),
  },
  {
    accessorKey: "marketValueCents",
    header: ({ column }) => (
      <SortableHeader column={column} className="justify-end">Market Value</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums font-medium text-foreground">
        {formatCurrency(row.original.marketValueCents)}
      </div>
    ),
  },
  {
    accessorKey: "gainLossCents",
    header: ({ column }) => (
      <SortableHeader column={column} className="justify-end">Gain/Loss ($)</SortableHeader>
    ),
    cell: ({ row }) => <GainLossCell cents={row.original.gainLossCents} />,
  },
  {
    accessorKey: "gainLossPercent",
    header: ({ column }) => (
      <SortableHeader column={column} className="justify-end">Gain/Loss (%)</SortableHeader>
    ),
    cell: ({ row }) => {
      const { gainLossPercent } = row.original;
      const trendColor =
        gainLossPercent > 0 ? "text-gain" : gainLossPercent < 0 ? "text-loss" : "text-muted-foreground";

      return (
        <div className={cn("text-right tabular-nums font-medium", trendColor)}>
          {formatPercent(gainLossPercent, { showSign: true })}
        </div>
      );
    },
  },
  {
    accessorKey: "custodianLabel",
    header: ({ column }) => <SortableHeader column={column}>Custodian</SortableHeader>,
    cell: ({ row }) => (
      <div className="text-foreground">
        <div className="text-sm">{row.original.custodianLabel}</div>
        <div className="text-xs text-muted-foreground">{row.original.accountName}</div>
      </div>
    ),
  },
];

// ─── Grouped View Types & Helpers ───────────────────────────────────

interface GroupedHolding {
  /** Group key — ticker for market assets, holding ID for manual */
  groupKey: string;
  ticker: string | null;
  name: string;
  assetType: string;
  assetTypeLabel: string;
  totalShares: number;
  weightedAvgCostCents: number;
  currentPriceCents: number;
  totalMarketValueCents: number;
  totalGainLossCents: number;
  gainLossPercent: number;
  accountCount: number;
  /** Individual holdings within this group */
  children: HoldingRow[];
}

function groupHoldingsByTicker(data: HoldingRow[]): GroupedHolding[] {
  const groups = new Map<string, HoldingRow[]>();

  for (const row of data) {
    // Group market assets by ticker, non-market by holding ID (no grouping)
    const key = row.ticker ? row.ticker.toUpperCase() : `__solo_${row.id}`;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  const result: GroupedHolding[] = [];

  for (const [key, children] of groups) {
    const totalShares = children.reduce((s, c) => s + c.shares, 0);
    const totalCostBasis = children.reduce((s, c) => s + c.shares * c.avgCostCents, 0);
    const totalMarketValueCents = children.reduce((s, c) => s + c.marketValueCents, 0);
    const totalGainLossCents = children.reduce((s, c) => s + c.gainLossCents, 0);
    const totalCostBasisSum = children.reduce(
      (s, c) => s + (c.shares > 0 ? c.shares * c.avgCostCents : c.marketValueCents - c.gainLossCents),
      0,
    );
    const gainLossPercent =
      totalCostBasisSum !== 0 ? (totalGainLossCents / totalCostBasisSum) * 100 : 0;
    const weightedAvgCostCents =
      totalShares > 0 ? Math.round(totalCostBasis / totalShares) : children[0].avgCostCents;

    const uniqueAccounts = new Set(children.map((c) => c.accountId));

    result.push({
      groupKey: key,
      ticker: children[0].ticker,
      name: children[0].name,
      assetType: children[0].assetType,
      assetTypeLabel: children[0].assetTypeLabel,
      totalShares,
      weightedAvgCostCents,
      currentPriceCents: children[0].currentPriceCents,
      totalMarketValueCents,
      totalGainLossCents,
      gainLossPercent,
      accountCount: uniqueAccounts.size,
      children: children.sort((a, b) => b.marketValueCents - a.marketValueCents),
    });
  }

  // Sort groups by total market value descending
  result.sort((a, b) => b.totalMarketValueCents - a.totalMarketValueCents);

  return result;
}

// ─── Grouped Table Component ────────────────────────────────────────

function GroupedTable({
  groups,
  globalFilter,
  assetTypeFilter,
}: {
  groups: GroupedHolding[];
  globalFilter: string;
  assetTypeFilter: string[];
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Apply client-side filters
  const filteredGroups = React.useMemo(() => {
    let result = groups;

    if (assetTypeFilter.length > 0) {
      result = result.filter((g) => assetTypeFilter.includes(g.assetType));
    }

    if (globalFilter) {
      const search = globalFilter.toLowerCase();
      result = result.filter((g) =>
        g.name.toLowerCase().includes(search) ||
        (g.ticker?.toLowerCase().includes(search) ?? false) ||
        g.assetTypeLabel.toLowerCase().includes(search) ||
        g.children.some(
          (c) =>
            c.custodianLabel.toLowerCase().includes(search) ||
            c.accountName.toLowerCase().includes(search),
        ),
      );
    }

    return result;
  }, [groups, globalFilter, assetTypeFilter]);

  const totalRows = filteredGroups.reduce((s, g) => s + g.children.length, 0);

  if (filteredGroups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                <p className="text-sm text-muted-foreground">
                  {globalFilter || assetTypeFilter.length > 0
                    ? "No holdings match your filters."
                    : "No holdings found."}
                </p>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-8 px-2 py-3" />
              <TableHead className="px-4 py-3 font-medium text-muted-foreground">
                Name / Ticker
              </TableHead>
              <TableHead className="px-4 py-3 font-medium text-muted-foreground">
                Asset Type
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-muted-foreground">
                Shares
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-muted-foreground">
                Avg Cost
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-muted-foreground">
                Current Price
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-muted-foreground">
                Market Value
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-muted-foreground">
                Gain/Loss
              </TableHead>
              <TableHead className="px-4 py-3 font-medium text-muted-foreground">
                Accounts
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.map((group) => {
              const isExpanded = expanded.has(group.groupKey);
              const isMulti = group.children.length > 1;

              return (
                <React.Fragment key={group.groupKey}>
                  {/* ── Group header row ── */}
                  <TableRow
                    className={cn(
                      "transition-colors",
                      isMulti
                        ? "cursor-pointer hover:bg-muted/40"
                        : "hover:bg-muted/30",
                      isExpanded && "bg-muted/20",
                    )}
                    onClick={isMulti ? () => toggleGroup(group.groupKey) : undefined}
                  >
                    <TableCell className="w-8 px-2 py-3">
                      {isMulti && (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {isMulti ? (
                        <div className="flex flex-col">
                          {group.ticker && (
                            <span className="font-semibold text-foreground">
                              {group.ticker}
                            </span>
                          )}
                          <span className={cn(
                            "text-muted-foreground",
                            group.ticker ? "text-xs" : "font-medium text-foreground",
                          )}>
                            {group.name}
                          </span>
                        </div>
                      ) : (
                        <Link
                          href={`/holdings/${group.children[0].id}`}
                          className="group block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col">
                            {group.ticker && (
                              <span className="font-semibold text-foreground group-hover:text-primary">
                                {group.ticker}
                              </span>
                            )}
                            <span className={cn(
                              "text-muted-foreground",
                              group.ticker
                                ? "text-xs"
                                : "font-medium text-foreground group-hover:text-primary",
                            )}>
                              {group.name}
                            </span>
                          </div>
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="secondary" className="rounded-md font-normal">
                        {group.assetTypeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                      {group.totalShares > 0 ? formatShares(group.totalShares) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums text-foreground">
                      {group.weightedAvgCostCents > 0
                        ? formatCurrency(group.weightedAvgCostCents)
                        : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums text-foreground">
                      {group.currentPriceCents > 0
                        ? formatCurrency(group.currentPriceCents)
                        : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                      {formatCurrency(group.totalMarketValueCents)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <GainLossCell
                        cents={group.totalGainLossCents}
                        percent={group.gainLossPercent}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-foreground">
                      {isMulti ? (
                        <Badge variant="outline" className="font-normal">
                          {group.accountCount} account{group.accountCount !== 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <div>
                          <div className="text-sm">
                            {group.children[0].custodianLabel}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {group.children[0].accountName}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* ── Expanded child rows ── */}
                  {isExpanded &&
                    group.children.map((child) => (
                      <TableRow
                        key={child.id}
                        className="bg-muted/10 transition-colors hover:bg-muted/20"
                      >
                        <TableCell className="w-8 px-2 py-2.5" />
                        <TableCell className="px-4 py-2.5 pl-8">
                          <Link
                            href={`/holdings/${child.id}`}
                            className="group block"
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                              <span className="text-sm text-muted-foreground group-hover:text-primary">
                                {child.accountName}
                              </span>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="text-xs text-muted-foreground">
                            {child.custodianLabel}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground">
                          {child.shares > 0 ? formatShares(child.shares) : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground">
                          {child.avgCostCents > 0
                            ? formatCurrency(child.avgCostCents)
                            : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground">
                          {child.currentPriceCents > 0
                            ? formatCurrency(child.currentPriceCents)
                            : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground">
                          {formatCurrency(child.marketValueCents)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right">
                          <GainLossCell
                            cents={child.gainLossCents}
                            percent={child.gainLossPercent}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <div className="text-xs text-muted-foreground">
                            {child.custodianLabel}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Results summary */}
      <div className="text-xs text-muted-foreground">
        {filteredGroups.length} group{filteredGroups.length !== 1 ? "s" : ""} ·{" "}
        {totalRows} holding{totalRows !== 1 ? "s" : ""}
      </div>
    </>
  );
}

// ─── View Toggle ────────────────────────────────────────────────────

type ViewMode = "flat" | "grouped";

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
      <button
        onClick={() => onChange("flat")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "flat"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="h-3.5 w-3.5" />
        Flat
      </button>
      <button
        onClick={() => onChange("grouped")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "grouped"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        Grouped
      </button>
    </div>
  );
}

// ─── DataTable Component ─────────────────────────────────────────────

interface HoldingsDataTableProps {
  data: HoldingRow[];
}

export function HoldingsDataTable({ data }: HoldingsDataTableProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("flat");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [assetTypeFilter, setAssetTypeFilter] = React.useState<string[]>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const { name, ticker, custodianLabel, accountName, assetTypeLabel } = row.original;
      return (
        name.toLowerCase().includes(search) ||
        (ticker?.toLowerCase().includes(search) ?? false) ||
        custodianLabel.toLowerCase().includes(search) ||
        accountName.toLowerCase().includes(search) ||
        assetTypeLabel.toLowerCase().includes(search)
      );
    },
  });

  // Sync asset type filter with column filter
  React.useEffect(() => {
    if (assetTypeFilter.length > 0) {
      table.getColumn("assetTypeLabel")?.setFilterValue(assetTypeFilter);
    } else {
      table.getColumn("assetTypeLabel")?.setFilterValue(undefined);
    }
  }, [assetTypeFilter, table]);

  const isFiltered = globalFilter !== "" || assetTypeFilter.length > 0;

  // Pre-compute grouped data
  const groupedData = React.useMemo(() => groupHoldingsByTicker(data), [data]);

  return (
    <div className="space-y-4">
      {/* Toolbar: Search + Filters + View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search holdings..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <ViewToggle mode={viewMode} onChange={setViewMode} />

          {/* Asset Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                Asset Type
                {assetTypeFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 rounded-sm px-1 font-normal">
                    {assetTypeFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter by asset type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(ASSET_TYPES).map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={assetTypeFilter.includes(key)}
                  onCheckedChange={(checked) => {
                    setAssetTypeFilter((prev) =>
                      checked ? [...prev, key] : prev.filter((v) => v !== key),
                    );
                  }}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setGlobalFilter("");
                setAssetTypeFilter([]);
              }}
            >
              Clear
              <X className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Flat view (TanStack Table) ── */}
      {viewMode === "flat" && (
        <>
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="px-4 py-3">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      <p className="text-sm text-muted-foreground">
                        {isFiltered
                          ? "No holdings match your filters."
                          : "No holdings found."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Results summary */}
          <div className="text-xs text-muted-foreground">
            Showing {table.getRowModel().rows.length} of {data.length} holding{data.length !== 1 ? "s" : ""}
          </div>
        </>
      )}

      {/* ── Grouped view ── */}
      {viewMode === "grouped" && (
        <GroupedTable
          groups={groupedData}
          globalFilter={globalFilter}
          assetTypeFilter={assetTypeFilter}
        />
      )}
    </div>
  );
}
