"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditLotDialog } from "@/components/forms/edit-lot-dialog";
import { DeleteLotDialog } from "@/components/forms/delete-lot-dialog";

interface LotRowActionsProps {
  lotId: string;
  holdingId: string;
  holdingName: string;
  lotNumber: number;
  isMarketAsset: boolean;
  assetType: string;
  totalLotCount: number;
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

export function LotRowActions({
  lotId,
  holdingId,
  holdingName,
  lotNumber,
  isMarketAsset,
  assetType,
  totalLotCount,
  currentValues,
}: LotRowActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100"
          onClick={() => setIsEditOpen(true)}
          title={`Edit lot #${lotNumber}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit lot #{lotNumber}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive/70 opacity-0 hover:text-destructive group-hover:opacity-100"
          onClick={() => setIsDeleteOpen(true)}
          title={`Delete lot #${lotNumber}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Delete lot #{lotNumber}</span>
        </Button>
      </div>

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
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      <DeleteLotDialog
        lotId={lotId}
        holdingId={holdingId}
        lotNumber={lotNumber}
        isLastLot={totalLotCount <= 1}
        holdingName={holdingName}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  );
}
