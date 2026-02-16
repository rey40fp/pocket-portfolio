"use client";

import {
  useState,
  useTransition,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  Trash2,
  Pencil,
  DollarSign,
  Hash,
  BarChart3,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ASSET_TYPES,
  MARKET_ASSET_TYPES,
  type AssetType,
} from "@/lib/constants";
import { importHoldingsFromCSV } from "@/server/actions/holdings";

// ─── Constants ──────────────────────────────────────────────────────

const EXPECTED_HEADERS = [
  "account_name",
  "account_number",
  "ticker",
  "name",
  "asset_type",
  "shares",
  "cost_per_share",
  "total_cost",
  "date_acquired",
] as const;

type CsvField = (typeof EXPECTED_HEADERS)[number];

const VALID_ASSET_TYPES = Object.keys(ASSET_TYPES) as string[];
const MARKET_TYPES = MARKET_ASSET_TYPES as AssetType[];
const MAX_FILE_SIZE_MB = 5;
const MAX_ROWS = 500;

// ─── Types ──────────────────────────────────────────────────────────

interface CsvRawRow {
  account_name: string;
  account_number: string;
  ticker: string;
  name: string;
  asset_type: string;
  shares: string;
  cost_per_share: string;
  total_cost: string;
  date_acquired: string;
}

interface EditableRow {
  id: string;
  data: CsvRawRow;
}

interface RowValidation {
  errors: Record<string, string>;
  isValid: boolean;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  accountsCreated: string[];
}

interface CsvImportDialogProps {
  trigger?: React.ReactNode;
}

// ─── CSV Parser ─────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): {
  rows: CsvRawRow[];
  headerError: string | null;
} {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], headerError: "File is empty" };
  }

  const rawHeaders = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
  );

  // account_number is optional in headers
  const requiredHeaders = EXPECTED_HEADERS.filter(
    (h) => h !== "account_number",
  );
  const missing = requiredHeaders.filter((h) => !rawHeaders.includes(h));
  if (missing.length > 0) {
    return {
      rows: [],
      headerError: `Missing required columns: ${missing.join(", ")}. Download the template for the correct format.`,
    };
  }

  const idx: Record<string, number> = {};
  for (const h of EXPECTED_HEADERS) idx[h] = rawHeaders.indexOf(h);

  const rows: CsvRawRow[] = [];
  for (let i = 1; i < lines.length && i <= MAX_ROWS; i++) {
    const f = parseCsvLine(lines[i]);
    rows.push({
      account_name: idx["account_name"] >= 0 ? (f[idx["account_name"]] ?? "") : "",
      account_number: idx["account_number"] >= 0 ? (f[idx["account_number"]] ?? "") : "",
      ticker: idx["ticker"] >= 0 ? (f[idx["ticker"]] ?? "") : "",
      name: idx["name"] >= 0 ? (f[idx["name"]] ?? "") : "",
      asset_type: idx["asset_type"] >= 0 ? (f[idx["asset_type"]] ?? "") : "",
      shares: idx["shares"] >= 0 ? (f[idx["shares"]] ?? "") : "",
      cost_per_share: idx["cost_per_share"] >= 0 ? (f[idx["cost_per_share"]] ?? "") : "",
      total_cost: idx["total_cost"] >= 0 ? (f[idx["total_cost"]] ?? "") : "",
      date_acquired: idx["date_acquired"] >= 0 ? (f[idx["date_acquired"]] ?? "") : "",
    });
  }

  return { rows, headerError: null };
}

// ─── Row Validator ──────────────────────────────────────────────────

function validateRow(raw: CsvRawRow): RowValidation {
  const errors: Record<string, string> = {};

  // account_name — required
  if (!raw.account_name.trim()) {
    errors.account_name = "Required";
  } else if (raw.account_name.trim().length > 200) {
    errors.account_name = "Max 200 characters";
  }

  // name — required, max 200 chars
  if (!raw.name.trim()) {
    errors.name = "Required";
  } else if (raw.name.trim().length > 200) {
    errors.name = "Max 200 characters";
  }

  // asset_type — required, must be valid
  const normalizedType = raw.asset_type
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!normalizedType) {
    errors.asset_type = "Required";
  } else if (!VALID_ASSET_TYPES.includes(normalizedType)) {
    errors.asset_type = "Invalid type";
  }

  const isMarket = MARKET_TYPES.includes(normalizedType as AssetType);

  // ticker — required for market assets
  if (isMarket) {
    if (!raw.ticker.trim()) {
      errors.ticker = "Required for market assets";
    } else if (raw.ticker.trim().length > 10) {
      errors.ticker = "Max 10 characters";
    } else if (!/^[A-Za-z0-9.\-^/]+$/.test(raw.ticker.trim())) {
      errors.ticker = "Invalid characters";
    }
  }

  // shares — required for market assets
  if (isMarket) {
    if (!raw.shares.trim()) {
      errors.shares = "Required for market assets";
    } else {
      const n = parseFloat(raw.shares);
      if (isNaN(n) || n <= 0) errors.shares = "Must be positive";
    }
  } else if (raw.shares.trim()) {
    const n = parseFloat(raw.shares);
    if (isNaN(n) || n < 0) errors.shares = "Must be non-negative";
  }

  // cost_per_share — optional
  if (raw.cost_per_share.trim()) {
    const n = parseFloat(raw.cost_per_share);
    if (isNaN(n) || n < 0) errors.cost_per_share = "Must be non-negative";
  }

  // total_cost — required
  if (!raw.total_cost.trim()) {
    errors.total_cost = "Required";
  } else {
    const n = parseFloat(raw.total_cost);
    if (isNaN(n) || n < 0) errors.total_cost = "Must be non-negative";
  }

  // date_acquired — optional (performance tracks from inception if omitted)
  if (raw.date_acquired.trim()) {
    const d = raw.date_acquired.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      errors.date_acquired = "Use YYYY-MM-DD";
    } else {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) {
        errors.date_acquired = "Invalid date";
      } else if (parsed > new Date()) {
        errors.date_acquired = "Cannot be future";
      }
    }
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}

// ─── Helpers ────────────────────────────────────────────────────────

function dollarsToCents(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function formatDollars(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

let rowIdCounter = 0;
function nextRowId(): string {
  return `row-${++rowIdCounter}`;
}

function emptyRow(): CsvRawRow {
  return {
    account_name: "",
    account_number: "",
    ticker: "",
    name: "",
    asset_type: "",
    shares: "",
    cost_per_share: "",
    total_cost: "",
    date_acquired: "",
  };
}

// ─── Summary Computation ────────────────────────────────────────────

interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalCostBasis: number;
  byAssetType: Record<string, { count: number; totalCost: number }>;
  byAccount: Record<string, { count: number; totalCost: number; number?: string }>;
  uniqueTickers: number;
  uniqueAccounts: number;
}

function computeSummary(
  rows: EditableRow[],
  validations: Map<string, RowValidation>,
): ImportSummary {
  const byAssetType: Record<string, { count: number; totalCost: number }> = {};
  const byAccount: Record<string, { count: number; totalCost: number; number?: string }> = {};
  const tickers = new Set<string>();
  let totalCostBasis = 0;
  let validCount = 0;
  let invalidCount = 0;

  for (const row of rows) {
    const v = validations.get(row.id);
    if (!v?.isValid) {
      invalidCount++;
      continue;
    }
    validCount++;

    const cost = parseFloat(row.data.total_cost) || 0;
    totalCostBasis += cost;

    const type =
      row.data.asset_type.trim().toLowerCase().replace(/\s+/g, "_") || "unknown";
    if (!byAssetType[type]) byAssetType[type] = { count: 0, totalCost: 0 };
    byAssetType[type].count++;
    byAssetType[type].totalCost += cost;

    const acctKey = row.data.account_name.trim() || "Unnamed";
    if (!byAccount[acctKey])
      byAccount[acctKey] = { count: 0, totalCost: 0, number: row.data.account_number.trim() || undefined };
    byAccount[acctKey].count++;
    byAccount[acctKey].totalCost += cost;

    if (row.data.ticker.trim()) tickers.add(row.data.ticker.trim().toUpperCase());
  }

  return {
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    totalCostBasis,
    byAssetType,
    byAccount,
    uniqueTickers: tickers.size,
    uniqueAccounts: Object.keys(byAccount).length,
  };
}

// ─── Editable Cell ──────────────────────────────────────────────────

interface EditableCellProps {
  value: string;
  field: CsvField;
  error?: string;
  onChange: (value: string) => void;
  className?: string;
}

function EditableCell({
  value,
  field,
  error,
  onChange,
  className,
}: EditableCellProps) {
  if (field === "asset_type") {
    return (
      <div className="relative">
        <select
          value={value.trim().toLowerCase().replace(/\s+/g, "_")}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-7 w-full rounded border bg-transparent px-1.5 text-xs outline-none transition-colors",
            error
              ? "border-destructive/60 bg-destructive/5 focus:border-destructive"
              : "border-border focus:border-primary",
            className,
          )}
        >
          <option value="">Select...</option>
          {VALID_ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {ASSET_TYPES[t as AssetType]}
            </option>
          ))}
        </select>
        {error && (
          <span className="absolute -bottom-3.5 left-0 text-[10px] text-destructive">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type={field === "date_acquired" ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={
          field === "shares" ||
          field === "cost_per_share" ||
          field === "total_cost"
            ? "decimal"
            : undefined
        }
        placeholder={
          field === "account_name"
            ? "Account name"
            : field === "account_number"
              ? "Optional"
              : field === "ticker"
                ? "AAPL"
                : field === "name"
                  ? "Holding name"
                  : field === "shares"
                    ? "0"
                    : field === "cost_per_share"
                      ? "0.00"
                      : field === "total_cost"
                        ? "0.00"
                        : ""
        }
        className={cn(
          "h-7 w-full rounded border bg-transparent px-1.5 text-xs outline-none transition-colors",
          field === "ticker" && "font-mono uppercase",
          (field === "shares" ||
            field === "cost_per_share" ||
            field === "total_cost") &&
            "text-right font-mono",
          error
            ? "border-destructive/60 bg-destructive/5 focus:border-destructive"
            : "border-border focus:border-primary",
          className,
        )}
      />
      {error && (
        <span className="absolute -bottom-3.5 left-0 whitespace-nowrap text-[10px] text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Summary Cards ──────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: ImportSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Hash className="h-3.5 w-3.5" />
          Holdings
        </div>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {summary.validRows}
          {summary.invalidRows > 0 && (
            <span className="ml-1 text-xs font-normal text-destructive">
              ({summary.invalidRows} invalid)
            </span>
          )}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          Total Cost Basis
        </div>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {formatDollars(summary.totalCostBasis.toFixed(2))}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          Accounts
        </div>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {summary.uniqueAccounts}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          Asset Types
        </div>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {Object.keys(summary.byAssetType).length}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

type Step = "upload" | "edit" | "confirm" | "result";

export function CsvImportDialog({ trigger }: CsvImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live validations derived from rows
  const validations = useMemo(() => {
    const map = new Map<string, RowValidation>();
    for (const row of rows) {
      map.set(row.id, validateRow(row.data));
    }
    return map;
  }, [rows]);

  const validRows = useMemo(
    () => rows.filter((r) => validations.get(r.id)?.isValid),
    [rows, validations],
  );
  const invalidRows = useMemo(
    () => rows.filter((r) => !validations.get(r.id)?.isValid),
    [rows, validations],
  );

  const summary = useMemo(
    () => computeSummary(rows, validations),
    [rows, validations],
  );

  // ── Cell editing ────────────────────────────────────────────────

  function updateCell(rowId: string, field: CsvField, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, data: { ...r.data, [field]: value } } : r,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId(), data: emptyRow() }]);
  }

  function deleteRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  // ── File handling ───────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    setServerError(null);
    setHeaderError(null);

    if (!file.name.endsWith(".csv")) {
      setServerError("Please upload a .csv file");
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setServerError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows: parsed, headerError: hErr } = parseCsv(text);

      if (hErr) {
        setHeaderError(hErr);
        setRows([]);
        setFileName(file.name);
        setStep("edit");
        return;
      }

      if (parsed.length === 0) {
        setHeaderError("No data rows found in the file");
        setRows([]);
        setFileName(file.name);
        setStep("edit");
        return;
      }

      setRows(parsed.map((data) => ({ id: nextRowId(), data })));
      setFileName(file.name);
      setStep("edit");
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Import ──────────────────────────────────────────────────────

  function handleImport() {
    if (validRows.length === 0) {
      setServerError("No valid rows to import");
      return;
    }

    setServerError(null);
    startTransition(async () => {
      try {
        const payload = validRows.map((r) => {
          const normalizedType = r.data.asset_type
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
          return {
            accountName: r.data.account_name.trim(),
            accountNumber: r.data.account_number.trim() || null,
            ticker: r.data.ticker.trim() || null,
            name: r.data.name.trim(),
            assetType: normalizedType,
            shares: r.data.shares.trim() || null,
            costBasisCents: dollarsToCents(r.data.total_cost),
            costPerShareCents: r.data.cost_per_share.trim()
              ? dollarsToCents(r.data.cost_per_share)
              : null,
            acquiredAt: r.data.date_acquired.trim()
              ? new Date(r.data.date_acquired.trim()).toISOString()
              : null,
          };
        });

        const result = await importHoldingsFromCSV(payload);

        setImportResult({
          success: true,
          imported: result.imported,
          failed: invalidRows.length,
          accountsCreated: result.accountsCreated,
        });
        setStep("result");
      } catch (err) {
        setServerError(
          err instanceof Error
            ? err.message
            : "Import failed. Please try again.",
        );
      }
    });
  }

  // ── Reset ───────────────────────────────────────────────────────

  function handleReset() {
    setStep("upload");
    setFileName(null);
    setRows([]);
    setHeaderError(null);
    setImportResult(null);
    setServerError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) handleReset();
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-y-auto",
          step === "upload" ? "sm:max-w-xl" : "sm:max-w-6xl",
        )}
      >
        {/* Step indicator */}
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          {(
            [
              ["upload", "Upload"],
              ["edit", "Edit & Validate"],
              ["confirm", "Confirm"],
              ["result", "Done"],
            ] as const
          ).map(([key, label], i) => (
            <div key={key} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-border" />}
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  step === key
                    ? "bg-primary text-primary-foreground"
                    : rows.length > 0 &&
                        (
                          ["upload", "edit", "confirm", "result"] as const
                        ).indexOf(step) >
                          (
                            ["upload", "edit", "confirm", "result"] as const
                          ).indexOf(key)
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  step === key && "font-medium text-foreground",
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STEP 1: UPLOAD                                         */}
        {/* ═══════════════════════════════════════════════════════ */}
        {step === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Holdings from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV with your holdings. Accounts will be created
                automatically from the account_name column. You can review
                and edit everything before import.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              {/* Download template */}
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">CSV Template</p>
                    <p className="text-xs text-muted-foreground">
                      Includes account name, holdings, and sample data
                    </p>
                  </div>
                </div>
                <a
                  href="/templates/holdings-import-template.csv"
                  download="holdings-import-template.csv"
                >
                  <Button variant="outline" size="sm">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </a>
              </div>

              {/* File drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Drop your CSV file here or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    .csv files up to {MAX_FILE_SIZE_MB}MB · Max {MAX_ROWS} rows
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Validation rules */}
              <details className="rounded-lg border border-border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
                  Column Guide &amp; Validation Rules
                </summary>
                <ul className="grid gap-1.5 px-4 pb-3 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">account_name</strong> —
                    Required. Existing accounts are matched by name; new ones
                    are created automatically.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">account_number</strong>{" "}
                    — Optional. Stored in account notes for reference.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">name</strong> — Required.
                    Holding name, max 200 characters.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">asset_type</strong> —
                    Required:{" "}
                    <code className="rounded bg-muted px-1">
                      {VALID_ASSET_TYPES.join(", ")}
                    </code>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">ticker</strong> —
                    Required for market assets. Max 10 chars.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">shares</strong> —
                    Required for market assets. Positive number.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">total_cost</strong> —
                    Required. Dollar amount (e.g. 1955.00).
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">cost_per_share</strong>{" "}
                    — Optional. Dollar amount.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">date_acquired</strong> —
                    Optional. YYYY-MM-DD. If omitted, performance tracks from
                    import date.
                  </li>
                </ul>
              </details>

              {serverError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {serverError}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STEP 2: EDIT & VALIDATE                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        {step === "edit" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Edit &amp; Validate
              </DialogTitle>
              <DialogDescription>
                {fileName && (
                  <span className="font-medium text-foreground">
                    {fileName}
                  </span>
                )}{" "}
                — Edit any cell directly. Errors are highlighted in red.
                Dates are optional; leave blank to track from import date.
              </DialogDescription>
            </DialogHeader>

            {headerError ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                  <XCircle className="h-7 w-7 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Invalid CSV Format
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    {headerError}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {/* Summary badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    {rows.length} row{rows.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="gap-1 border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {validRows.length} valid
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-destructive/20 bg-destructive/10 text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                      {invalidRows.length} with errors
                    </Badge>
                  )}
                  <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {summary.uniqueAccounts} account
                      {summary.uniqueAccounts !== 1 ? "s" : ""}
                    </span>
                    <span>
                      Total:{" "}
                      <span className="font-semibold text-foreground">
                        {formatDollars(summary.totalCostBasis.toFixed(2))}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Editable spreadsheet */}
                <div className="max-h-[45vh] overflow-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                      <tr>
                        <th className="w-8 px-2 py-2 text-center text-muted-foreground">
                          #
                        </th>
                        <th className="min-w-[120px] px-1 py-2 text-left font-semibold text-muted-foreground">
                          Account *
                        </th>
                        <th className="px-1 py-2 text-left font-semibold text-muted-foreground">
                          Acct #
                        </th>
                        <th className="px-1 py-2 text-left font-semibold text-muted-foreground">
                          Ticker
                        </th>
                        <th className="min-w-[120px] px-1 py-2 text-left font-semibold text-muted-foreground">
                          Name *
                        </th>
                        <th className="min-w-[90px] px-1 py-2 text-left font-semibold text-muted-foreground">
                          Type *
                        </th>
                        <th className="px-1 py-2 text-right font-semibold text-muted-foreground">
                          Shares
                        </th>
                        <th className="px-1 py-2 text-right font-semibold text-muted-foreground">
                          $/Share
                        </th>
                        <th className="px-1 py-2 text-right font-semibold text-muted-foreground">
                          Total *
                        </th>
                        <th className="px-1 py-2 text-left font-semibold text-muted-foreground">
                          Date
                        </th>
                        <th className="w-8 px-1 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const v = validations.get(row.id);
                        const errs = v?.errors ?? {};
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "border-t border-border",
                              !v?.isValid && "bg-destructive/[0.03]",
                            )}
                          >
                            <td className="px-2 pb-5 pt-2 text-center text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.account_name}
                                field="account_name"
                                error={errs.account_name}
                                onChange={(v) =>
                                  updateCell(row.id, "account_name", v)
                                }
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.account_number}
                                field="account_number"
                                onChange={(v) =>
                                  updateCell(row.id, "account_number", v)
                                }
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.ticker}
                                field="ticker"
                                error={errs.ticker}
                                onChange={(v) => updateCell(row.id, "ticker", v)}
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.name}
                                field="name"
                                error={errs.name}
                                onChange={(v) => updateCell(row.id, "name", v)}
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.asset_type}
                                field="asset_type"
                                error={errs.asset_type}
                                onChange={(v) =>
                                  updateCell(row.id, "asset_type", v)
                                }
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.shares}
                                field="shares"
                                error={errs.shares}
                                onChange={(v) => updateCell(row.id, "shares", v)}
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.cost_per_share}
                                field="cost_per_share"
                                error={errs.cost_per_share}
                                onChange={(v) =>
                                  updateCell(row.id, "cost_per_share", v)
                                }
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.total_cost}
                                field="total_cost"
                                error={errs.total_cost}
                                onChange={(v) =>
                                  updateCell(row.id, "total_cost", v)
                                }
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2">
                              <EditableCell
                                value={row.data.date_acquired}
                                field="date_acquired"
                                error={errs.date_acquired}
                                onChange={(v) =>
                                  updateCell(row.id, "date_acquired", v)
                                }
                              />
                            </td>
                            <td className="px-1 pb-5 pt-2 text-center">
                              <button
                                type="button"
                                onClick={() => deleteRow(row.id)}
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                title="Delete row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add row */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  className="w-fit"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </Button>

                {serverError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" />
                    {serverError}
                  </div>
                )}
              </div>
            )}

            {!headerError && (
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isPending}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (validRows.length === 0) {
                      setServerError(
                        "Fix the errors above — no valid rows to import",
                      );
                      return;
                    }
                    setServerError(null);
                    setStep("confirm");
                  }}
                  disabled={validRows.length === 0}
                >
                  Review Import
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STEP 3: CONFIRM                                        */}
        {/* ═══════════════════════════════════════════════════════ */}
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Import</DialogTitle>
              <DialogDescription>
                Review the final summary below. Accounts that don&apos;t exist
                yet will be created automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              {/* KPI cards */}
              <SummaryCards summary={summary} />

              {/* Accounts breakdown */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Building2 className="h-4 w-4" />
                  Accounts ({summary.uniqueAccounts})
                </h4>
                <div className="grid gap-2">
                  {Object.entries(summary.byAccount)
                    .sort((a, b) => b[1].totalCost - a[1].totalCost)
                    .map(([name, info]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {name}
                          </span>
                          {info.number && (
                            <span className="text-[10px] text-muted-foreground">
                              #{info.number}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            · {info.count} holding
                            {info.count !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                          {formatDollars(info.totalCost.toFixed(2))}
                        </span>
                      </div>
                    ))}
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  Existing accounts are matched by name. New accounts are
                  created with custodian &quot;Other&quot; — you can update
                  the custodian and type from the Accounts page after import.
                </p>
              </div>

              {/* Asset type breakdown */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-3 text-sm font-semibold text-foreground">
                  By Asset Type
                </h4>
                <div className="grid gap-2">
                  {Object.entries(summary.byAssetType)
                    .sort((a, b) => b[1].totalCost - a[1].totalCost)
                    .map(([type, info]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {ASSET_TYPES[type as AssetType] ?? type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {info.count} holding{info.count !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                          {formatDollars(info.totalCost.toFixed(2))}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Preview table */}
              <div className="max-h-[25vh] overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                        Account
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                        Ticker
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                        Name
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                        Type
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-muted-foreground">
                        Shares
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-muted-foreground">
                        Total Cost
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">
                          {row.data.account_name}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.data.ticker.trim().toUpperCase() || "—"}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2">
                          {row.data.name}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {ASSET_TYPES[
                              row.data.asset_type
                                .trim()
                                .toLowerCase()
                                .replace(/\s+/g, "_") as AssetType
                            ] ?? row.data.asset_type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {row.data.shares || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          {formatDollars(row.data.total_cost)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.data.date_acquired || "From import"}
                        </td>
                      </tr>
                    ))}
                    {/* Totals */}
                    <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                      <td className="px-3 py-2" colSpan={5} />
                      <td className="px-3 py-2 text-right font-mono text-foreground">
                        {formatDollars(summary.totalCostBasis.toFixed(2))}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        Total
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Skipped rows warning */}
              {invalidRows.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    {invalidRows.length} row
                    {invalidRows.length !== 1 ? "s" : ""} with errors will be
                    skipped
                  </div>
                </div>
              )}

              {serverError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {serverError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setServerError(null);
                  setStep("edit");
                }}
                disabled={isPending}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Data
              </Button>
              <Button onClick={handleImport} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {validRows.length} Holding
                {validRows.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STEP 4: RESULT                                         */}
        {/* ═══════════════════════════════════════════════════════ */}
        {step === "result" && importResult && (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-6 text-center">
              {importResult.success ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      Successfully imported {importResult.imported} holding
                      {importResult.imported !== 1 ? "s" : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Total cost basis:{" "}
                      <span className="font-semibold text-foreground">
                        {formatDollars(summary.totalCostBasis.toFixed(2))}
                      </span>
                    </p>
                    {importResult.accountsCreated.length > 0 && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">
                          {importResult.accountsCreated.length} new account
                          {importResult.accountsCreated.length !== 1
                            ? "s"
                            : ""}{" "}
                          created:
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {importResult.accountsCreated.join(", ")}
                        </p>
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {importResult.failed} row
                        {importResult.failed !== 1 ? "s" : ""} were skipped
                        due to validation errors.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      Import Failed
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Something went wrong. Please try again.
                    </p>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                <X className="h-3.5 w-3.5" />
                Close
              </Button>
              {importResult.success && (
                <Button onClick={handleReset}>
                  <Upload className="h-3.5 w-3.5" />
                  Import More
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
