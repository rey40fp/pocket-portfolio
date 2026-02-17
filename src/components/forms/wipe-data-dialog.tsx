"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wipeUserData } from "@/server/actions/data-wipe";

const CONFIRMATION_PHRASE = "DELETE ALL MY DATA";

export function WipeDataDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  const isConfirmed = confirmation === CONFIRMATION_PHRASE;

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      setConfirmation("");
      setError(null);
      setResult(null);
    }
  }

  function handleWipe() {
    if (!isConfirmed) return;
    setError(null);

    startTransition(async () => {
      const res = await wipeUserData({ confirmation });

      if (res.success) {
        setResult(res.deletedCounts);
        setConfirmation("");
      } else {
        setError(res.error);
      }
    });
  }

  const totalDeleted = result
    ? Object.values(result).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Wipe All Data
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          {result ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <AlertDialogTitle className="text-center">
                Data Wiped Successfully
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {totalDeleted} record{totalDeleted !== 1 ? "s" : ""} deleted
                across all tables. Your account is now a clean slate.
              </AlertDialogDescription>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-center">
                Wipe All Data?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-sm">
                This will <strong>permanently delete</strong> all your
                portfolios, accounts, holdings, lots, realized transactions,
                household memberships, and audit history. Your login account
                will remain active with a clean slate.
              </AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>

        {!result && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-medium text-destructive">
                This action cannot be undone. There is no way to recover your
                data after this operation.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmation" className="text-sm">
                Type{" "}
                <span className="font-mono font-semibold text-destructive">
                  {CONFIRMATION_PHRASE}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id="confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                disabled={isPending}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          {result ? (
            <Button
              onClick={() => handleOpenChange(false)}
              className="w-full"
            >
              Done
            </Button>
          ) : (
            <>
              <AlertDialogCancel disabled={isPending}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleWipe}
                disabled={!isConfirmed || isPending}
                className="gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wiping...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Wipe Everything
                  </>
                )}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
