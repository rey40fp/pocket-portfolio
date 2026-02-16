"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  X,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  "ticker",
  "name",
  "asset_type",
  "shares",
  "cost_per_share",
  "total_cost",
  "date_acquired",
] as const;

const VALID_ASSET_TYPES = Object.keys(ASSET_TYPES) as string[];
const MARKET_TYPES = MARKET_ASSET_TYPES as AssetType[];
const MAX_FILE_SIZE_MB = 5;
const MAX_ROWS = 500;

// ─── Types ──────────────────────────────────────────────────────────

interface CsvRawRow {
  ticker: string;
  name: string;
  asset_type: string;
  shares: string;
  cost_per_share: string;
  total_cost: string;
  date_acquired: string;
}

interface RowValidation {
  rowIndex: number;
  raw: CsvRawRow;
  errors: string[];
  isValid: boolean;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

interface AccountOption {
  id: string;
  name: string;
  custodianLabel: string;
}

interface CsvImportDialogProps {
  accounts: AccountOption[];
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

function parseCsv(text: string): { headers: string[]; rows: CsvRawRow[]; headerError: string | null } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], headerError: "File is empty" };
  }

  const rawHeaders = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
  );

  const missing = EXPECTED_HEADERS.filter((h) => !rawHeaders.includes(h));
  if (missing.length > 0) {
    return {
      headers: rawHeaders,
      rows: [],
      headerError: `Missing required columns: ${missing.join(", ")}. Download the template for the correct format.`,
    };
  }

  const headerIndexMap: Record<string, number> = {};
  for (const h of EXPECTED_HEADERS) {
    headerIndexMap[h] = rawHeaders.indexOf(h);
  }

  const rows: CsvRawRow[] = [];
  for (let i = 1; i < lines.length && i <= MAX_ROWS; i++) {
    const fields = parseCsvLine(lines[i]);
    rows.push({
      ticker: fields[headerIndexMap["ticker"]] ?? "",
      name: fields[headerIndexMap["name"]] ?? "",
      asset_type: fields[headerIndexMap["asset_type"]] ?? "",
      shares: fields[headerIndexMap["shares"]] ?? "",
      cost_per_share: fields[headerIndexMap["cost_per_share"]] ?? "",
      total_cost: fields[headerIndexMap["total_cost"]] ?? "",
      date_acquired: fields[headerIndexMap["date_acquired"]] ?? "",
    });
  }

  return { headers: rawHeaders, rows, headerError: null };
}

// ─── Row Validator ──────────────────────────────────────────────────

function validateRow(raw: CsvRawRow, rowIndex: number): RowValidation {
  const errors: string[] = [];

  // name — required, max 200 chars
  if (!raw.name.trim()) {
    errors.push("Name is required");
  } else if (raw.name.trim().length > 200) {
    errors.push("Name must be 200 characters or fewer");
  }

  // asset_type — required, must be a valid key
  const normalizedType = raw.asset_type.trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalizedType) {
    errors.push("Asset type is required");
  } else if (!VALID_ASSET_TYPES.includes(normalizedType)) {
    errors.push(
      `Invalid asset type "${raw.asset_type}". Must be one of: ${VALID_ASSET_TYPES.join(", ")}`,
    );
  }

  const isMarket = MARKET_TYPES.includes(normalizedType as AssetType);

  // ticker — required for market assets, max 10 chars, must be alpha-numeric
  if (isMarket) {
    if (!raw.ticker.trim()) {
      errors.push("Ticker is required for market assets (stock, etf, mutual_fund, bond, crypto)");
    } else if (raw.ticker.trim().length > 10) {
      errors.push("Ticker must be 10 characters or fewer");
    } else if (!/^[A-Za-z0-9.\-^/]+$/.test(raw.ticker.trim())) {
      errors.push("Ticker contains invalid characters");
    }
  }

  // shares — required for market assets, must be a positive number
  if (isMarket) {
    if (!raw.shares.trim()) {
      errors.push("Shares are required for market assets");
    } else {
      const sharesNum = parseFloat(raw.shares);
      if (isNaN(sharesNum) || sharesNum <= 0) {
        errors.push("Shares must be a positive number");
      }
    }
  } else if (raw.shares.trim()) {
    const sharesNum = parseFloat(raw.shares);
    if (isNaN(sharesNum) || sharesNum < 0) {
      errors.push("Shares must be a non-negative number if provided");
    }
  }

  // cost_per_share — optional, must be a positive number if provided
  if (raw.cost_per_share.trim()) {
    const cpsNum = parseFloat(raw.cost_per_share);
    if (isNaN(cpsNum) || cpsNum < 0) {
      errors.push("Cost per share must be a non-negative number");
    }
  }

  // total_cost — required, must be a positive number (in dollars)
  if (!raw.total_cost.trim()) {
    errors.push("Total cost is required");
  } else {
    const costNum = parseFloat(raw.total_cost);
    if (isNaN(costNum) || costNum < 0) {
      errors.push("Total cost must be a non-negative dollar amount");
    }
  }

  // date_acquired — optional, must be valid YYYY-MM-DD
  if (raw.date_acquired.trim()) {
    const dateStr = raw.date_acquired.trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      errors.push("Date acquired must be in YYYY-MM-DD format");
    } else {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        errors.push("Date acquired is not a valid date");
      } else if (parsed > new Date()) {
        errors.push("Date acquired cannot be in the future");
      }
    }
  }

  return { rowIndex, raw, errors, isValid: errors.length === 0 };
}

// ─── Dollar → Cents ─────────────────────────────────────────────────

function dollarsToCents(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

// ─── Component ──────────────────────────────────────────────────────

type Step = "upload" | "preview" | "result";

export function CsvImportDialog({ accounts, trigger }: CsvImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("upload");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = validatedRows.filter((r) => r.isValid);
  const invalidRows = validatedRows.filter((r) => !r.isValid);

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
      const { rows, headerError: hErr } = parseCsv(text);

      if (hErr) {
        setHeaderError(hErr);
        setValidatedRows([]);
        setFileName(file.name);
        setStep("preview");
        return;
      }

      if (rows.length === 0) {
        setHeaderError("No data rows found in the file");
        setValidatedRows([]);
        setFileName(file.name);
        setStep("preview");
        return;
      }

      const validated = rows.map((row, idx) => validateRow(row, idx + 2));
      setValidatedRows(validated);
      setFileName(file.name);
      setStep("preview");
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
    if (!selectedAccountId) {
      setServerError("Please select an account");
      return;
    }

    if (validRows.length === 0) {
      setServerError("No valid rows to import");
      return;
    }

    setServerError(null);
    startTransition(async () => {
      try {
        const payload = validRows.map((r) => {
          const normalizedType = r.raw.asset_type.trim().toLowerCase().replace(/\s+/g, "_");
          return {
            ticker: r.raw.ticker.trim() || null,
            name: r.raw.name.trim(),
            assetType: normalizedType,
            shares: r.raw.shares.trim() || null,
            costBasisCents: dollarsToCents(r.raw.total_cost),
            costPerShareCents: r.raw.cost_per_share.trim()
              ? dollarsToCents(r.raw.cost_per_share)
              : null,
            acquiredAt: r.raw.date_acquired.trim()
              ? new Date(r.raw.date_acquired.trim()).toISOString()
              : null,
          };
        });

        const result = await importHoldingsFromCSV(selectedAccountId, payload);

        setImportResult({
          success: true,
          imported: result.imported,
          failed: invalidRows.length,
          errors: [],
        });
        setStep("result");
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Import failed. Please try again.",
        );
      }
    });
  }

  // ── Reset ───────────────────────────────────────────────────────

  function handleReset() {
    setStep("upload");
    setFileName(null);
    setValidatedRows([]);
    setHeaderError(null);
    setImportResult(null);
    setServerError(null);
    setSelectedAccountId("");
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

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {/* ── Step 1: Upload ──────────────────────────────────── */}
        {step === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Holdings from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file to bulk-import holdings into an account.
                Download the template to get started.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              {/* Account selector */}
              <div className="grid gap-2">
                <Label>Target Account</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}{" "}
                        <span className="text-muted-foreground">
                          — {a.custodianLabel}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Download template */}
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">CSV Template</p>
                    <p className="text-xs text-muted-foreground">
                      Pre-formatted with all required columns and sample data
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
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  Validation Rules
                </h4>
                <ul className="grid gap-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">name</strong> — Required,
                    max 200 characters
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">asset_type</strong> —
                    Required. Must be one of:{" "}
                    <code className="rounded bg-muted px-1">
                      {VALID_ASSET_TYPES.join(", ")}
                    </code>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">ticker</strong> —
                    Required for market assets (stock, etf, mutual_fund, bond,
                    crypto). Max 10 chars, alphanumeric.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">shares</strong> —
                    Required for market assets. Must be a positive number.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">total_cost</strong> —
                    Required. Dollar amount (e.g. 1955.00). Must be non-negative.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">cost_per_share</strong> —
                    Optional. Dollar amount.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <strong className="text-foreground">date_acquired</strong> —
                    Optional. Must be YYYY-MM-DD format. Cannot be in the future.
                  </li>
                </ul>
              </div>

              {/* Server error */}
              {serverError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {serverError}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: Preview ─────────────────────────────────── */}
        {step === "preview" && (
          <>
            <DialogHeader>
              <DialogTitle>Preview &amp; Validate</DialogTitle>
              <DialogDescription>
                {fileName && (
                  <span className="font-medium text-foreground">{fileName}</span>
                )}{" "}
                — Review the parsed data below. Rows with errors will be
                skipped during import.
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
                    {validatedRows.length} total row
                    {validatedRows.length !== 1 ? "s" : ""}
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
                </div>

                {/* Data table */}
                <div className="max-h-[40vh] overflow-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                          Row
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                          Status
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
                          Cost/Share
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
                      {validatedRows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={cn(
                            "border-t border-border transition-colors",
                            !row.isValid && "bg-destructive/5",
                          )}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.rowIndex}
                          </td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            ) : (
                              <div className="group relative">
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                                <div className="absolute bottom-full left-0 z-20 mb-1 hidden w-64 rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:block">
                                  <ul className="list-disc pl-3">
                                    {row.errors.map((err, i) => (
                                      <li key={i} className="text-destructive">
                                        {err}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {row.raw.ticker || "—"}
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-2 font-medium">
                            {row.raw.name || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.raw.asset_type ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {ASSET_TYPES[
                                  row.raw.asset_type
                                    .trim()
                                    .toLowerCase()
                                    .replace(/\s+/g, "_") as AssetType
                                ] ?? row.raw.asset_type}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {row.raw.shares || "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {row.raw.cost_per_share
                              ? `$${parseFloat(row.raw.cost_per_share).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {row.raw.total_cost
                              ? `$${parseFloat(row.raw.total_cost).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.raw.date_acquired || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invalid rows detail */}
                {invalidRows.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      {invalidRows.length} row
                      {invalidRows.length !== 1 ? "s" : ""} will be skipped
                    </div>
                    <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                      {invalidRows.map((row) => (
                        <div key={row.rowIndex}>
                          <span className="font-medium text-foreground">
                            Row {row.rowIndex}:
                          </span>{" "}
                          {row.errors.join("; ")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account reminder */}
                {!selectedAccountId && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Select a target account before importing.
                  </div>
                )}

                {/* Account selector (if not yet selected) */}
                {!selectedAccountId && (
                  <div className="grid gap-2">
                    <Label>Target Account</Label>
                    <Select
                      value={selectedAccountId}
                      onValueChange={setSelectedAccountId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}{" "}
                            <span className="text-muted-foreground">
                              — {a.custodianLabel}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                <Button variant="outline" onClick={handleReset} disabled={isPending}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    isPending || validRows.length === 0 || !selectedAccountId
                  }
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import {validRows.length} Holding
                  {validRows.length !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        {/* ── Step 3: Result ──────────────────────────────────── */}
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
                    {importResult.failed > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {importResult.failed} row
                        {importResult.failed !== 1 ? "s" : ""} were skipped due
                        to validation errors.
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
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
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
