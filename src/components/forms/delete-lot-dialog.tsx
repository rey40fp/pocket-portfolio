"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteLotAction } from "@/server/actions/holdings";

// ─── Component ──────────────────────────────────────────────────────

interface DeleteLotDialogProps {
  lotId: string;
  holdingId: string;
  lotNumber: number;
  isLastLot: boolean;
  holdingName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteLotDialog({
  lotId,
  holdingId,
  lotNumber,
  isLastLot,
  holdingName,
  isOpen,
  onOpenChange,
}: DeleteLotDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function handleDelete() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await deleteLotAction(lotId, holdingId);
        if (result.success) {
          onOpenChange(false);
          if (result.holdingDeleted) {
            router.push("/holdings");
          }
        }
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to delete lot",
        );
      }
    });
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Lot #{lotNumber}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete this lot? This action cannot be
                undone.
              </p>
              {isLastLot && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">
                    This is the last lot for{" "}
                    <span className="font-semibold">
                      {holdingName ?? "this holding"}
                    </span>
                    . Deleting it will also remove the entire holding from your
                    portfolio.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLastLot ? "Delete Lot & Holding" : "Delete Lot"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
