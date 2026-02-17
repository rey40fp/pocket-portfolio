"use client";

import { useState, useTransition } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLotAction } from "@/server/actions/holdings";

// ─── Types ───────────────────────────────────────────────────────────

interface EditLotDialogProps {
  lotId: string;
  holdingId: string;
  lotNumber: number;
  isMarketAsset: boolean;
  assetType: string;
  currentValues: {
    shares: number;
    costBasisCents: number;
    costPerShareCents: number;
    acquiredAt: Date | null;
    currentValueCents: number;
    mortgageMonthlyCents: number | null;
    escrowMonthlyCents: number | null;
    interestRateBps: number | null;
    notes: string | null;
  };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number {
  const val = parseFloat(dollars);
  if (isNaN(val) || val < 0) return 0;
  return Math.round(val * 100);
}

/** Parse a dollar string to a raw number (NOT cents). For sub-cent precision. */
function parseDollars(dollars: string): number {
  const val = parseFloat(dollars);
  if (isNaN(val) || val < 0) return 0;
  return val;
}

/** Format a dollar amount with appropriate precision (more decimals for tiny values).
 *  Returns the formatted string WITHOUT a $ prefix (caller adds it). */
function formatDollars(dollars: number): string {
  if (dollars === 0) return "0.00";
  if (dollars < 0.01) return dollars.toPrecision(4);
  return dollars.toFixed(2);
}

function bpsToPercent(bps: number | null): string {
  if (bps == null) return "";
  return (bps / 100).toFixed(2);
}

function percentToBps(percent: string): number | null {
  const val = parseFloat(percent);
  if (isNaN(val) || val < 0) return null;
  return Math.round(val * 100);
}

function formatDateForInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

// ─── Component ───────────────────────────────────────────────────────

export function EditLotDialog({
  lotId,
  holdingId,
  lotNumber,
  isMarketAsset,
  assetType,
  currentValues,
  isOpen,
  onOpenChange,
}: EditLotDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const isRealEstate = assetType === "real_estate";
  const isCash = assetType === "cash";
  const isManual = !isMarketAsset;

  // Form state — for market assets: shares + cost/share are editable,
  // cost basis is auto-calculated. For cash: single "Total Amount" field.
  // For other manual assets: cost basis is editable directly.
  const [shares, setShares] = useState(
    currentValues.shares > 0 ? currentValues.shares.toString() : "",
  );
  const [costPerShare, setCostPerShare] = useState(
    currentValues.costPerShareCents > 0
      ? centsToDollars(currentValues.costPerShareCents)
      : "",
  );
  const [costBasis, setCostBasis] = useState(
    centsToDollars(currentValues.costBasisCents),
  );
  // For cash holdings, the "total amount" maps to both costBasis and currentValue
  const [cashAmount, setCashAmount] = useState(
    isCash ? centsToDollars(currentValues.currentValueCents || currentValues.costBasisCents) : "",
  );
  const [acquiredAt, setAcquiredAt] = useState(
    formatDateForInput(currentValues.acquiredAt),
  );
  const [currentValue, setCurrentValue] = useState(
    centsToDollars(currentValues.currentValueCents),
  );
  const [mortgageMonthly, setMortgageMonthly] = useState(
    currentValues.mortgageMonthlyCents
      ? centsToDollars(currentValues.mortgageMonthlyCents)
      : "",
  );
  const [escrowMonthly, setEscrowMonthly] = useState(
    currentValues.escrowMonthlyCents
      ? centsToDollars(currentValues.escrowMonthlyCents)
      : "",
  );
  const [interestRate, setInterestRate] = useState(
    bpsToPercent(currentValues.interestRateBps),
  );
  const [notes, setNotes] = useState(currentValues.notes ?? "");

  // Derived cost basis for market assets — shares × cost/share (computed in dollars for precision)
  const computedCostBasis = (() => {
    const s = parseFloat(shares);
    const cps = parseDollars(costPerShare);
    if (s > 0 && cps > 0) {
      const totalDollars = s * cps;
      return formatDollars(totalDollars);
    }
    return "—";
  })();

  function handleSave() {
    setServerError(null);

    startTransition(async () => {
      try {
        let costBasisCents: number;
        let costPerShareCents: number | null;
        let sharesVal: string | null;

        if (isCash) {
          // Cash: shares always 1, amount = cost basis = current value
          const amountCents = dollarsToCents(cashAmount);
          sharesVal = "1";
          costBasisCents = amountCents;
          costPerShareCents = null;
        } else if (isMarketAsset) {
          // Cost basis = shares × cost/share (compute in dollars for sub-cent precision)
          sharesVal = shares || null;
          const cpsValue = parseDollars(costPerShare);
          costPerShareCents = cpsValue > 0 ? Math.round(cpsValue * 100) : null;
          const s = sharesVal ? parseFloat(sharesVal) : 0;
          costBasisCents = s > 0 && cpsValue > 0
            ? Math.round(s * cpsValue * 100)
            : 0;
        } else {
          // Manual assets: cost basis entered directly
          sharesVal = shares || null;
          costBasisCents = dollarsToCents(costBasis);
          costPerShareCents = null;
        }

        const payload: Record<string, unknown> = {
          shares: sharesVal,
          costBasisCents,
          costPerShareCents,
          acquiredAt: acquiredAt
            ? new Date(acquiredAt + "T00:00:00Z").toISOString()
            : null,
          notes: notes || null,
        };

        // Manual asset fields
        if (isCash) {
          // Cash: current value = total amount
          payload.currentValueCents = dollarsToCents(cashAmount);
          payload.interestRateBps = interestRate
            ? percentToBps(interestRate)
            : null;
        } else if (isManual) {
          payload.currentValueCents = dollarsToCents(currentValue);
        }
        if (isRealEstate) {
          payload.mortgageMonthlyCents = mortgageMonthly
            ? dollarsToCents(mortgageMonthly)
            : null;
          payload.escrowMonthlyCents = escrowMonthly
            ? dollarsToCents(escrowMonthly)
            : null;
        }

        const result = await updateLotAction(lotId, holdingId, payload as never);
        if (result.success) {
          onOpenChange(false);
        }
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to update lot",
        );
      }
    });
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Reset to current values when closing
      setShares(currentValues.shares > 0 ? currentValues.shares.toString() : "");
      setCostPerShare(
        currentValues.costPerShareCents > 0
          ? centsToDollars(currentValues.costPerShareCents)
          : "",
      );
      setCostBasis(centsToDollars(currentValues.costBasisCents));
      setCashAmount(
        isCash
          ? centsToDollars(currentValues.currentValueCents || currentValues.costBasisCents)
          : "",
      );
      setAcquiredAt(formatDateForInput(currentValues.acquiredAt));
      setCurrentValue(centsToDollars(currentValues.currentValueCents));
      setMortgageMonthly(
        currentValues.mortgageMonthlyCents
          ? centsToDollars(currentValues.mortgageMonthlyCents)
          : "",
      );
      setEscrowMonthly(
        currentValues.escrowMonthlyCents
          ? centsToDollars(currentValues.escrowMonthlyCents)
          : "",
      );
      setInterestRate(bpsToPercent(currentValues.interestRateBps));
      setNotes(currentValues.notes ?? "");
      setServerError(null);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lot #{lotNumber}</DialogTitle>
          <DialogDescription>
            Update the position details for this lot.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* ── Cash: simplified single "Total Amount" ── */}
          {isCash ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="edit-lot-cash-amount">Total Cash Amount ($)</Label>
                <Input
                  id="edit-lot-cash-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 25000.00"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is the total cash balance. Shares are always 1 for cash holdings.
                </p>
              </div>

              {/* Cash APY */}
              <div className="grid gap-2">
                <Label htmlFor="edit-lot-apy">
                  APY (%){" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="edit-lot-apy"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 4.50"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              {/* Shares (market assets) */}
              {isMarketAsset && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-lot-shares">Shares</Label>
                  <Input
                    id="edit-lot-shares"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 100"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                  />
                </div>
              )}

              {/* Cost/Share (market assets, editable) */}
              {isMarketAsset && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-lot-cps">Avg Cost/Share ($)</Label>
                  <Input
                    id="edit-lot-cps"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 150.00"
                    value={costPerShare}
                    onChange={(e) => setCostPerShare(e.target.value)}
                  />
                </div>
              )}

              {/* Cost Basis — auto-calculated for market assets, editable for manual */}
              {isMarketAsset ? (
                <div className="grid gap-2">
                  <Label>Total Cost Basis</Label>
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                    {computedCostBasis !== "—"
                      ? `$${computedCostBasis}`
                      : "—"}
                    <span className="ml-auto text-xs text-muted-foreground/70">
                      shares × cost/share
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="edit-lot-cost-basis">
                    Cost Basis ($)
                  </Label>
                  <Input
                    id="edit-lot-cost-basis"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 15000.00"
                    value={costBasis}
                    onChange={(e) => setCostBasis(e.target.value)}
                  />
                </div>
              )}

              {/* Current Value (manual assets only, excludes cash which is handled above) */}
              {isManual && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-lot-value">
                    Current Value ($)
                  </Label>
                  <Input
                    id="edit-lot-value"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 500000.00"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                  />
                </div>
              )}

              {/* Real estate monthly expenses */}
              {isRealEstate && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-lot-mortgage">
                      Mortgage/mo ($)
                    </Label>
                    <Input
                      id="edit-lot-mortgage"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 2500.00"
                      value={mortgageMonthly}
                      onChange={(e) => setMortgageMonthly(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-lot-escrow">
                      Escrow/mo ($)
                    </Label>
                    <Input
                      id="edit-lot-escrow"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 400.00"
                      value={escrowMonthly}
                      onChange={(e) => setEscrowMonthly(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Date Acquired */}
          <div className="grid gap-2">
            <Label htmlFor="edit-lot-date">
              Date Acquired{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="edit-lot-date"
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="edit-lot-notes">
              Notes{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="edit-lot-notes"
              rows={2}
              placeholder="Any extra notes about this lot..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
