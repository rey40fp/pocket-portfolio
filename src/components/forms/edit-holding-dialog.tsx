"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ASSET_TYPES,
  MARKET_ASSET_TYPES,
  SECTORS,
  type AssetType,
  type Sector,
} from "@/lib/constants";
import { updateHolding } from "@/server/actions/holdings";
import {
  setManualPriceAction,
  clearManualOverrideAction,
} from "@/server/actions/prices";

// ─── Form Schema ────────────────────────────────────────────────────

const assetTypeKeys = Object.keys(ASSET_TYPES) as [AssetType, ...AssetType[]];
const sectorKeys = Object.keys(SECTORS) as [Sector, ...Sector[]];

const editHoldingFormSchema = z.object({
  name: z
    .string()
    .min(1, "Holding name is required")
    .max(200, "Holding name must be 200 characters or fewer"),
  assetType: z.enum(assetTypeKeys),
  ticker: z
    .string()
    .max(10, "Ticker must be 10 characters or fewer")
    .default("")
    .transform((v) => (v ? v.toUpperCase() : "")),
  sector: z
    .enum(sectorKeys)
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
});

type EditHoldingFormValues = z.input<typeof editHoldingFormSchema>;

const assetTypeEntries = Object.entries(ASSET_TYPES).map(([key, label]) => ({
  value: key,
  label,
}));

const sectorEntries = Object.entries(SECTORS).map(([key, label]) => ({
  value: key,
  label,
}));

function isMarketType(type: string): boolean {
  return MARKET_ASSET_TYPES.includes(type as AssetType);
}

/** Get the displayable dollar string from priceInfo, preferring priceDollars for precision. */
function getPriceDisplay(priceInfo: { priceDollars: number | null; priceCents: number } | null | undefined): string {
  if (!priceInfo) return "";
  const dollars = priceInfo.priceDollars ?? priceInfo.priceCents / 100;
  if (dollars === 0) return "";
  // For very small prices (sub-cent), show up to 8 decimal places
  if (dollars < 0.01) return dollars.toPrecision(4);
  return dollars.toFixed(2);
}

// ─── Component ──────────────────────────────────────────────────────

interface EditHoldingDialogProps {
  holdingId: string;
  currentValues: {
    name: string;
    assetType: string;
    ticker?: string | null;
    sector?: string | null;
    notes?: string | null;
  };
  /** Current price info from price_cache (if any). */
  priceInfo?: {
    priceCents: number;
    priceDollars: number | null;
    isManualOverride: boolean;
  } | null;
  /** When provided, the dialog open state is controlled externally (no built-in trigger). */
  externalOpen?: boolean;
  /** Callback for external open state changes. */
  onExternalOpenChange?: (open: boolean) => void;
}

export function EditHoldingDialog({
  holdingId,
  currentValues,
  priceInfo,
  externalOpen,
  onExternalOpenChange,
}: EditHoldingDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setIsOpen = isControlled
    ? (open: boolean) => onExternalOpenChange?.(open)
    : setInternalOpen;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // Manual price override state
  const [isManualPriceEnabled, setIsManualPriceEnabled] = useState(
    priceInfo?.isManualOverride ?? false,
  );
  const [manualPrice, setManualPrice] = useState(
    priceInfo?.isManualOverride ? getPriceDisplay(priceInfo) : "",
  );

  // Sync manual override state when priceInfo prop changes (dialog re-opens)
  useEffect(() => {
    setIsManualPriceEnabled(priceInfo?.isManualOverride ?? false);
    setManualPrice(
      priceInfo?.isManualOverride ? getPriceDisplay(priceInfo) : "",
    );
  }, [priceInfo]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditHoldingFormValues>({
    resolver: zodResolver(editHoldingFormSchema),
    defaultValues: {
      name: currentValues.name,
      assetType: currentValues.assetType as AssetType,
      ticker: currentValues.ticker ?? "",
      sector: (currentValues.sector ?? undefined) as EditHoldingFormValues["sector"],
      notes: currentValues.notes ?? "",
    },
  });

  const selectedSector = watch("sector");
  const selectedAssetType = watch("assetType");
  const showTicker = isMarketType(selectedAssetType);

  // Track whether manual price state has changed from the initial prop values
  const initialOverride = priceInfo?.isManualOverride ?? false;
  const initialPrice =
    priceInfo?.isManualOverride ? getPriceDisplay(priceInfo) : "";
  const hasPriceChanges =
    isManualPriceEnabled !== initialOverride ||
    (isManualPriceEnabled && manualPrice !== initialPrice);

  function onSubmit(data: EditHoldingFormValues) {
    setServerError(null);
    startTransition(async () => {
      try {
        const isMarket = isMarketType(data.assetType);
        const ticker = isMarket ? (data.ticker || null) : null;

        const result = await updateHolding(holdingId, {
          name: data.name,
          assetType: data.assetType,
          ticker,
          sector: data.sector || null,
          notes: data.notes || null,
        });

        // Handle manual price override
        if (isMarket && ticker) {
          if (isManualPriceEnabled && manualPrice) {
            const priceDollars = parseFloat(manualPrice);
            if (priceDollars > 0) {
              const priceResult = await setManualPriceAction(ticker, priceDollars);
              if (!priceResult.success) {
                setServerError(priceResult.error ?? "Failed to set manual price");
                return;
              }
            }
          } else if (!isManualPriceEnabled && priceInfo?.isManualOverride) {
            // User unchecked the override — clear it
            await clearManualOverrideAction(ticker);
          }
        }

        if (result.success) {
          setIsOpen(false);
        }
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to update holding",
        );
      }
    });
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      reset({
        name: currentValues.name,
        assetType: currentValues.assetType as AssetType,
        ticker: currentValues.ticker ?? "",
        sector: (currentValues.sector ?? undefined) as EditHoldingFormValues["sector"],
        notes: currentValues.notes ?? "",
      });
      setIsManualPriceEnabled(priceInfo?.isManualOverride ?? false);
      setManualPrice(
        priceInfo?.isManualOverride ? getPriceDisplay(priceInfo) : "",
      );
      setServerError(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Holding</DialogTitle>
          <DialogDescription>
            Update the details for this holding.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="edit-holding-name">Name</Label>
            <Input
              id="edit-holding-name"
              placeholder="e.g. Apple Inc."
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Asset Type */}
          <div className="grid gap-2">
            <Label>Asset Type</Label>
            <Select
              value={selectedAssetType}
              onValueChange={(val) =>
                setValue("assetType", val as AssetType, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {assetTypeEntries.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAssetType === "cash" && (
              <p className="text-xs text-muted-foreground">
                Cash holdings track total amount only — no market price needed.
              </p>
            )}
          </div>

          {/* Ticker (market assets only) */}
          {showTicker && (
            <div className="grid gap-2">
              <Label htmlFor="edit-holding-ticker">Ticker Symbol</Label>
              <Input
                id="edit-holding-ticker"
                placeholder="e.g. AAPL"
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
          )}

          {/* Manual Price Override (market assets with a ticker) */}
          {showTicker && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="manual-price-override"
                  checked={isManualPriceEnabled}
                  onCheckedChange={(checked) => {
                    setIsManualPriceEnabled(checked === true);
                    if (!checked) setManualPrice("");
                  }}
                />
                <Label
                  htmlFor="manual-price-override"
                  className="text-sm font-medium cursor-pointer"
                >
                  Set Price Manually
                </Label>
              </div>

              {isManualPriceEnabled && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="manual-price-input" className="text-xs text-muted-foreground">
                      Price Per Unit ($)
                    </Label>
                    <Input
                      id="manual-price-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 0.00002847"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                    />
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      This price won&apos;t be updated by automatic refreshes.
                      Uncheck to resume auto-pricing.
                    </span>
                  </div>
                </>
              )}

              {!isManualPriceEnabled && priceInfo?.isManualOverride && (
                <p className="text-xs text-muted-foreground">
                  Unchecking will resume automatic price updates for this ticker.
                </p>
              )}
            </div>
          )}

          {/* Sector */}
          <div className="grid gap-2">
            <Label>
              Sector{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select
              value={selectedSector ?? ""}
              onValueChange={(val) =>
                setValue("sector", val as EditHoldingFormValues["sector"], {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sector..." />
              </SelectTrigger>
              <SelectContent>
                {sectorEntries.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="edit-holding-notes">
              Notes{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="edit-holding-notes"
              placeholder="Any extra notes about this holding..."
              rows={3}
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || (!isDirty && !hasPriceChanges)}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
