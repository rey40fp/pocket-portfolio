"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditLotDialog } from "@/components/forms/edit-lot-dialog";

interface LotRowEditButtonProps {
  lotId: string;
  holdingId: string;
  lotNumber: number;
  isMarketAsset: boolean;
  assetType: string;
  currentValues: {
    shares: number;
    costBasisCents: number;
    costPerShareCents: number;
    acquiredAt: string | null;
    currentValueCents: number;
    mortgageMonthlyCents: number | null;
    escrowMonthlyCents: number | null;
    interestRateBps: number | null;
    notes: string | null;
  };
}

export function LotRowEditButton({
  lotId,
  holdingId,
  lotNumber,
  isMarketAsset,
  assetType,
  currentValues,
}: LotRowEditButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={() => setIsOpen(true)}
        title={`Edit lot #${lotNumber}`}
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Edit lot #{lotNumber}</span>
      </Button>

      <EditLotDialog
        lotId={lotId}
        holdingId={holdingId}
        lotNumber={lotNumber}
        isMarketAsset={isMarketAsset}
        assetType={assetType}
        currentValues={{
          ...currentValues,
          acquiredAt: currentValues.acquiredAt
            ? new Date(currentValues.acquiredAt)
            : null,
        }}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
