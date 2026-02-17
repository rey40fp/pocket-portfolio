"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ASSET_TYPES,
  MARKET_ASSET_TYPES,
  type AssetType,
} from "@/lib/constants";
import { addHolding } from "@/server/actions/holdings";

// ─── Helpers ─────────────────────────────────────────────────────────

const isMarketAsset = (type: string) =>
  MARKET_ASSET_TYPES.includes(type as AssetType);

/** Convert a dollars string (e.g. "150.50") to integer cents */
const dollarsToCents = (value: string): number => {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

/** Convert a percentage string (e.g. "5.25") to basis points */
const percentToBps = (value: string): number => {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

// ─── Form Schema ─────────────────────────────────────────────────────

const assetTypeKeys = Object.keys(ASSET_TYPES) as [AssetType, ...AssetType[]];

const addHoldingFormSchema = z
  .object({
    assetType: z.enum(assetTypeKeys, { message: "Please select an asset type" }),
    // Common
    name: z
      .string()
      .min(1, "Name is required")
      .max(200, "Name must be 200 characters or fewer"),
    notes: z.string().max(1000).optional(),

    // Market asset fields
    ticker: z.string().max(10).optional(),
    shares: z.string().optional(),
    costPerShare: z.string().optional(),
    acquiredAt: z.string().optional(),

    // Real estate fields
    purchasePrice: z.string().optional(),
    currentValue: z.string().optional(),
    monthlyMortgage: z.string().optional(),
    monthlyEscrow: z.string().optional(),

    // Cash fields
    balance: z.string().optional(),
    apy: z.string().optional(),

    // Other / generic fields
    costBasis: z.string().optional(),
    otherCurrentValue: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const type = data.assetType;

    if (isMarketAsset(type)) {
      if (!data.ticker || data.ticker.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ticker is required for market assets",
          path: ["ticker"],
        });
      }
      if (!data.shares || parseFloat(data.shares) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Shares must be a positive number",
          path: ["shares"],
        });
      }
      if (!data.costPerShare || parseFloat(data.costPerShare) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cost per share is required",
          path: ["costPerShare"],
        });
      }
    } else if (type === "real_estate") {
      if (!data.purchasePrice || parseFloat(data.purchasePrice) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Purchase price is required",
          path: ["purchasePrice"],
        });
      }
      if (!data.currentValue || parseFloat(data.currentValue) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Current value is required",
          path: ["currentValue"],
        });
      }
    } else if (type === "cash") {
      if (!data.balance || parseFloat(data.balance) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Balance is required",
          path: ["balance"],
        });
      }
    } else if (type === "other") {
      if (!data.costBasis || parseFloat(data.costBasis) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cost basis is required",
          path: ["costBasis"],
        });
      }
    }
  });

type AddHoldingFormValues = z.infer<typeof addHoldingFormSchema>;

// ─── Asset type entries ──────────────────────────────────────────────

const assetTypeEntries = Object.entries(ASSET_TYPES).map(([key, label]) => ({
  value: key,
  label,
}));

// ─── Component ───────────────────────────────────────────────────────

interface AccountOption {
  id: string;
  name: string;
  custodianLabel: string;
}

interface AddHoldingDialogProps {
  /** If provided, skip the account selector */
  accountId?: string;
  /** List of accounts for the user to choose from (required when accountId is not set) */
  accounts?: AccountOption[];
  /** Optionally override the trigger button */
  trigger?: React.ReactNode;
}

export function AddHoldingDialog({ accountId, accounts, trigger }: AddHoldingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accountId ?? "",
  );
  const needsAccountSelector = !accountId && accounts && accounts.length > 0;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddHoldingFormValues>({
    resolver: zodResolver(addHoldingFormSchema),
    defaultValues: {
      assetType: undefined,
      name: "",
      ticker: "",
      shares: "",
      costPerShare: "",
      acquiredAt: "",
      purchasePrice: "",
      currentValue: "",
      monthlyMortgage: "",
      monthlyEscrow: "",
      balance: "",
      apy: "",
      costBasis: "",
      otherCurrentValue: "",
      notes: "",
    },
  });

  const selectedAssetType = watch("assetType");
  const isMarket = selectedAssetType && isMarketAsset(selectedAssetType);
  const isRealEstate = selectedAssetType === "real_estate";
  const isCash = selectedAssetType === "cash";
  const isOther = selectedAssetType === "other";

  function onSubmit(data: AddHoldingFormValues) {
    setServerError(null);
    startTransition(async () => {
      try {
        // Build the payload based on asset type
        let shares: string | null = null;
        let costBasisCents = 0;
        let costPerShareCents: number | null = null;
        let acquiredAt: string | null = null;
        let currentValueCents: number | null = null;
        let mortgageMonthlyCents: number | null = null;
        let escrowMonthlyCents: number | null = null;
        let interestRateBps: number | null = null;

        if (isMarketAsset(data.assetType)) {
          shares = data.shares || null;
          const cpsValue = parseFloat(data.costPerShare || "0");
          costPerShareCents = cpsValue > 0 ? Math.round(cpsValue * 100) : null;
          const sharesNum = parseFloat(data.shares || "0");
          // Compute in dollars first for sub-cent precision, then convert to cents
          costBasisCents = Math.round(sharesNum * cpsValue * 100);
          acquiredAt = data.acquiredAt
            ? new Date(data.acquiredAt).toISOString()
            : null;
        } else if (data.assetType === "real_estate") {
          costBasisCents = dollarsToCents(data.purchasePrice || "0");
          currentValueCents = dollarsToCents(data.currentValue || "0");
          mortgageMonthlyCents = data.monthlyMortgage
            ? dollarsToCents(data.monthlyMortgage)
            : null;
          escrowMonthlyCents = data.monthlyEscrow
            ? dollarsToCents(data.monthlyEscrow)
            : null;
          acquiredAt = data.acquiredAt
            ? new Date(data.acquiredAt).toISOString()
            : null;
        } else if (data.assetType === "cash") {
          shares = "1";
          costBasisCents = dollarsToCents(data.balance || "0");
          currentValueCents = dollarsToCents(data.balance || "0");
          interestRateBps = data.apy ? percentToBps(data.apy) : null;
        } else {
          // "other"
          costBasisCents = dollarsToCents(data.costBasis || "0");
          currentValueCents = data.otherCurrentValue
            ? dollarsToCents(data.otherCurrentValue)
            : null;
          acquiredAt = data.acquiredAt
            ? new Date(data.acquiredAt).toISOString()
            : null;
        }

        const resolvedAccountId = accountId ?? selectedAccountId;
        if (!resolvedAccountId) {
          setServerError("Please select an account");
          return;
        }

        const result = await addHolding({
          accountId: resolvedAccountId,
          ticker: isMarketAsset(data.assetType) ? data.ticker || null : null,
          name: data.name,
          assetType: data.assetType,
          source: "manual",
          notes: data.notes || null,
          shares,
          costBasisCents,
          costPerShareCents,
          acquiredAt,
          currentValueCents,
          mortgageMonthlyCents,
          escrowMonthlyCents,
          interestRateBps,
        });

        if (result.success) {
          reset();
          setIsOpen(false);
        }
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to add holding",
        );
      }
    });
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      reset();
      setServerError(null);
      if (!accountId) setSelectedAccountId("");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <PlusCircle className="h-4 w-4" />
            Add Holding
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Holding</DialogTitle>
          <DialogDescription>
            Add a new position to this account. Fields change based on asset
            type.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          {/* Account Selector (when not scoped to a single account) */}
          {needsAccountSelector && (
            <div className="grid gap-2">
              <Label>Account</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account..." />
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

          {/* Asset Type */}
          <div className="grid gap-2">
            <Label htmlFor="assetType">Asset Type</Label>
            <Select
              value={selectedAssetType}
              onValueChange={(val) =>
                setValue(
                  "assetType",
                  val as AddHoldingFormValues["assetType"],
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select asset type..." />
              </SelectTrigger>
              <SelectContent>
                {assetTypeEntries.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assetType && (
              <p className="text-xs text-destructive">
                {errors.assetType.message}
              </p>
            )}
            {selectedAssetType === "cash" && (
              <p className="text-xs text-muted-foreground">
                Use Cash for money market funds (SPAXX, VMFXX), savings, or
                checking accounts.
              </p>
            )}
          </div>

          {/* Holding Name — always shown */}
          <div className="grid gap-2">
            <Label htmlFor="name">
              {isRealEstate
                ? "Property Name / Address"
                : isCash
                  ? "Account Name"
                  : "Holding Name"}
            </Label>
            <Input
              id="name"
              placeholder={
                isRealEstate
                  ? 'e.g. "123 Main St, Austin, TX"'
                  : isCash
                    ? 'e.g. "Schwab HYSA"'
                    : isMarket
                      ? 'e.g. "Apple Inc."'
                      : 'e.g. "2023 Tesla Model Y"'
              }
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* ── Market Asset Fields ───────────────────────────────── */}
          {isMarket && (
            <>
              {/* Ticker */}
              <div className="grid gap-2">
                <Label htmlFor="ticker">Ticker Symbol</Label>
                <Input
                  id="ticker"
                  placeholder='e.g. "AAPL", "BTC"'
                  className="uppercase"
                  {...register("ticker")}
                  aria-invalid={!!errors.ticker}
                />
                {errors.ticker && (
                  <p className="text-xs text-destructive">
                    {errors.ticker.message}
                  </p>
                )}
              </div>

              {/* Shares + Cost Per Share — side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="shares">Shares</Label>
                  <Input
                    id="shares"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 10.5"
                    {...register("shares")}
                    aria-invalid={!!errors.shares}
                  />
                  {errors.shares && (
                    <p className="text-xs text-destructive">
                      {errors.shares.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="costPerShare">Cost Per Share ($)</Label>
                  <Input
                    id="costPerShare"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 150.00"
                    {...register("costPerShare")}
                    aria-invalid={!!errors.costPerShare}
                  />
                  {errors.costPerShare && (
                    <p className="text-xs text-destructive">
                      {errors.costPerShare.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Date Acquired */}
              <div className="grid gap-2">
                <Label htmlFor="acquiredAt">
                  Date Acquired{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="acquiredAt"
                  type="date"
                  {...register("acquiredAt")}
                />
              </div>
            </>
          )}

          {/* ── Real Estate Fields ───────────────────────────────── */}
          {isRealEstate && (
            <>
              {/* Purchase Price + Current Value */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
                  <Input
                    id="purchasePrice"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 450000"
                    {...register("purchasePrice")}
                    aria-invalid={!!errors.purchasePrice}
                  />
                  {errors.purchasePrice && (
                    <p className="text-xs text-destructive">
                      {errors.purchasePrice.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currentValue">Current Value ($)</Label>
                  <Input
                    id="currentValue"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 525000"
                    {...register("currentValue")}
                    aria-invalid={!!errors.currentValue}
                  />
                  {errors.currentValue && (
                    <p className="text-xs text-destructive">
                      {errors.currentValue.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Monthly Mortgage + Escrow */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="monthlyMortgage">
                    Monthly Mortgage ($){" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="monthlyMortgage"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 2100"
                    {...register("monthlyMortgage")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="monthlyEscrow">
                    Monthly Escrow ($){" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="monthlyEscrow"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 450"
                    {...register("monthlyEscrow")}
                  />
                </div>
              </div>

              {/* Date Acquired */}
              <div className="grid gap-2">
                <Label htmlFor="acquiredAt">
                  Date Purchased{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="acquiredAt"
                  type="date"
                  {...register("acquiredAt")}
                />
              </div>
            </>
          )}

          {/* ── Cash Fields ──────────────────────────────────────── */}
          {isCash && (
            <>
              <p className="text-xs text-muted-foreground">
                Cash holdings track total balance only — no ticker or market
                price needed. Update the balance anytime it changes.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="balance">Total Balance ($)</Label>
                  <Input
                    id="balance"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 25000"
                    {...register("balance")}
                    aria-invalid={!!errors.balance}
                  />
                  {errors.balance && (
                    <p className="text-xs text-destructive">
                      {errors.balance.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apy">
                    APY (%){" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="apy"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 5.25"
                    {...register("apy")}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Other Asset Fields ───────────────────────────────── */}
          {isOther && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="costBasis">Cost Basis ($)</Label>
                  <Input
                    id="costBasis"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 35000"
                    {...register("costBasis")}
                    aria-invalid={!!errors.costBasis}
                  />
                  {errors.costBasis && (
                    <p className="text-xs text-destructive">
                      {errors.costBasis.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="otherCurrentValue">
                    Current Value ($){" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="otherCurrentValue"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 42000"
                    {...register("otherCurrentValue")}
                  />
                </div>
              </div>

              {/* Date Acquired */}
              <div className="grid gap-2">
                <Label htmlFor="acquiredAt">
                  Date Acquired{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="acquiredAt"
                  type="date"
                  {...register("acquiredAt")}
                />
              </div>
            </>
          )}

          {/* Notes — always shown when an asset type is selected */}
          {selectedAssetType && (
            <div className="grid gap-2">
              <Label htmlFor="notes">
                Notes{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Any extra details about this position..."
                rows={2}
                {...register("notes")}
              />
              {errors.notes && (
                <p className="text-xs text-destructive">
                  {errors.notes.message}
                </p>
              )}
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedAssetType}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Holding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
