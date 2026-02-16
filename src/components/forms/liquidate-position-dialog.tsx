"use client";

import { useState, useTransition, useMemo } from "react";
import { Ban, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatShares, cn } from "@/lib/utils";
import { liquidatePosition } from "@/server/actions/holdings";

// ─── Types ──────────────────────────────────────────────────────────

interface LotOption {
  id: string;
  shares: number;
  costBasisCents: number;
  costPerShareCents: number;
  acquiredAt: string | null;
  isLiquidated: boolean;
}

interface LiquidatePositionDialogProps {
  holdingId: string;
  holdingName: string;
  ticker: string | null;
  lots: LotOption[];
}

// ─── Component ──────────────────────────────────────────────────────

export function LiquidatePositionDialog({
  holdingName,
  ticker,
  lots,
}: LiquidatePositionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // Form state
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [sharesSold, setSharesSold] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [fees, setFees] = useState("");
  const [soldDate, setSoldDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Only show active (non-liquidated) lots
  const activeLots = useMemo(
    () => lots.filter((l) => !l.isLiquidated && l.shares > 0),
    [lots],
  );

  const selectedLot = activeLots.find((l) => l.id === selectedLotId) ?? null;

  // Parse numeric inputs
  const sharesSoldNum = parseFloat(sharesSold) || 0;
  const sellPriceNum = parseFloat(sellPrice) || 0;
  const feesNum = parseFloat(fees) || 0;

  // Live gain/loss calculation
  const preview = useMemo(() => {
    if (!selectedLot || sharesSoldNum <= 0 || sellPriceNum <= 0) return null;

    const sellPriceCents = Math.round(sellPriceNum * 100);
    const feesCents = Math.round(feesNum * 100);
    const costPerShare = selectedLot.costPerShareCents;
    const costBasis = Math.round(costPerShare * sharesSoldNum);
    const grossProceeds = Math.round(sellPriceCents * sharesSoldNum);
    const netProceeds = grossProceeds - feesCents;
    const realizedGainLoss = netProceeds - costBasis;
    const isFullSell = sharesSoldNum >= selectedLot.shares;

    return {
      costBasisCents: costBasis,
      grossProceedsCents: grossProceeds,
      netProceedsCents: netProceeds,
      feesCents,
      realizedGainLossCents: realizedGainLoss,
      isFullSell,
    };
  }, [selectedLot, sharesSoldNum, sellPriceNum, feesNum]);

  // Validation
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!selectedLotId) errs.push("Select a lot");
    if (sharesSoldNum <= 0) errs.push("Enter shares to sell");
    if (selectedLot && sharesSoldNum > selectedLot.shares)
      errs.push(`Cannot sell more than ${formatShares(selectedLot.shares)} shares`);
    if (sellPriceNum <= 0) errs.push("Enter sell price");
    if (feesNum < 0) errs.push("Fees cannot be negative");
    if (!soldDate) errs.push("Enter date sold");
    return errs;
  }, [selectedLotId, sharesSoldNum, selectedLot, sellPriceNum, feesNum, soldDate]);

  const isValid = errors.length === 0;

  function handleSubmit() {
    if (!isValid || !selectedLot) return;

    setServerError(null);
    startTransition(async () => {
      try {
        const result = await liquidatePosition({
          lotId: selectedLotId,
          sharesSold: sharesSoldNum,
          sellPriceCents: Math.round(sellPriceNum * 100),
          feesCents: Math.round(feesNum * 100),
          soldAt: new Date(soldDate).toISOString(),
        });
        if (result.success) {
          setIsOpen(false);
          resetForm();
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to liquidate position";
        if (message === "LOT_ALREADY_LIQUIDATED") {
          setServerError("This lot has already been sold.");
        } else if (message === "CANNOT_SELL_MORE_THAN_OWNED") {
          setServerError("Cannot sell more shares than you own in this lot.");
        } else {
          setServerError(message);
        }
      }
    });
  }

  function resetForm() {
    setSelectedLotId("");
    setSharesSold("");
    setSellPrice("");
    setFees("");
    setSoldDate(new Date().toISOString().split("T")[0]);
    setServerError(null);
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) resetForm();
  }

  // Auto-select the only lot if there's just one
  function handleOpen() {
    if (activeLots.length === 1) {
      setSelectedLotId(activeLots[0].id);
    }
    setIsOpen(true);
  }

  if (activeLots.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-loss/30 bg-loss/5 text-loss hover:bg-loss/10 hover:text-loss"
          onClick={handleOpen}
        >
          <Ban className="h-4 w-4" />
          Liquidate
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Sell Position
            {ticker && (
              <span className="text-primary">{ticker}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Sell shares from {holdingName}. Review the calculated gain/loss
            before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Lot Selector */}
          <div className="grid gap-2">
            <Label>Select Lot</Label>
            <Select value={selectedLotId} onValueChange={setSelectedLotId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a lot to sell from..." />
              </SelectTrigger>
              <SelectContent>
                {activeLots.map((lot, idx) => (
                  <SelectItem key={lot.id} value={lot.id}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">Lot {idx + 1}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{formatShares(lot.shares)} shares</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(lot.costPerShareCents)}/share
                      </span>
                      {lot.acquiredAt && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(lot.acquiredAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shares Sold */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="liq-shares">Shares to Sell</Label>
              {selectedLot && (
                <button
                  type="button"
                  onClick={() =>
                    setSharesSold(selectedLot.shares.toString())
                  }
                  className="text-xs text-primary hover:underline"
                >
                  Sell all ({formatShares(selectedLot.shares)})
                </button>
              )}
            </div>
            <Input
              id="liq-shares"
              type="number"
              step="any"
              min="0"
              max={selectedLot?.shares}
              placeholder="0"
              value={sharesSold}
              onChange={(e) => setSharesSold(e.target.value)}
            />
          </div>

          {/* Sell Price Per Share */}
          <div className="grid gap-2">
            <Label htmlFor="liq-price">Sell Price Per Share ($)</Label>
            <Input
              id="liq-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date Sold */}
            <div className="grid gap-2">
              <Label htmlFor="liq-date">Date Sold</Label>
              <Input
                id="liq-date"
                type="date"
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
              />
            </div>

            {/* Fees */}
            <div className="grid gap-2">
              <Label htmlFor="liq-fees">
                Fees ($){" "}
                <span className="font-normal text-muted-foreground">
                  optional
                </span>
              </Label>
              <Input
                id="liq-fees"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
          </div>

          {/* ── Gain/Loss Preview ── */}
          {preview && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Transaction Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cost Basis</span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(preview.costBasisCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gross Proceeds</span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(preview.grossProceedsCents)}
                  </span>
                </div>
                {preview.feesCents > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fees</span>
                    <span className="tabular-nums text-loss">
                      -{formatCurrency(preview.feesCents)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Net Proceeds</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {formatCurrency(preview.netProceedsCents)}
                  </span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      Realized Gain/Loss
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 tabular-nums text-base font-bold",
                        preview.realizedGainLossCents > 0
                          ? "text-gain"
                          : preview.realizedGainLossCents < 0
                            ? "text-loss"
                            : "text-foreground",
                      )}
                    >
                      {preview.realizedGainLossCents > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : preview.realizedGainLossCents < 0 ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      {formatCurrency(preview.realizedGainLossCents, {
                        showSign: true,
                      })}
                    </span>
                  </div>
                </div>
                {preview.isFullSell && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    This will fully liquidate this lot.
                    {activeLots.length === 1 &&
                      " The holding will be marked as fully liquidated."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isValid}
            variant="destructive"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
