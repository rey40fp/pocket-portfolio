"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAccount } from "@/server/actions/accounts";

// ─── Component ──────────────────────────────────────────────────────

interface DeleteAccountDialogProps {
  accountId: string;
  accountName: string;
}

export function DeleteAccountDialog({
  accountId,
  accountName,
}: DeleteAccountDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function handleDelete() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await deleteAccount({ accountId });
        if (result.success) {
          router.push("/accounts");
        }
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to delete account",
        );
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">
              {accountName}
            </span>
            ? This will remove the account from your portfolio. Holdings data
            will be preserved but hidden.
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
            Delete Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
