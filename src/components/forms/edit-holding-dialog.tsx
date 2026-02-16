"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Loader2 } from "lucide-react";
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
import { SECTORS } from "@/lib/constants";
import { updateHolding } from "@/server/actions/holdings";

// ─── Form Schema ────────────────────────────────────────────────────

const sectorKeys = Object.keys(SECTORS) as [string, ...string[]];

const editHoldingFormSchema = z.object({
  name: z
    .string()
    .min(1, "Holding name is required")
    .max(200, "Holding name must be 200 characters or fewer"),
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

const sectorEntries = Object.entries(SECTORS).map(([key, label]) => ({
  value: key,
  label,
}));

// ─── Component ──────────────────────────────────────────────────────

interface EditHoldingDialogProps {
  holdingId: string;
  currentValues: {
    name: string;
    ticker?: string | null;
    sector?: string | null;
    notes?: string | null;
  };
  isMarketAsset: boolean;
}

export function EditHoldingDialog({
  holdingId,
  currentValues,
  isMarketAsset,
}: EditHoldingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

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
      ticker: currentValues.ticker ?? "",
      sector: (currentValues.sector ?? undefined) as EditHoldingFormValues["sector"],
      notes: currentValues.notes ?? "",
    },
  });

  const selectedSector = watch("sector");

  function onSubmit(data: EditHoldingFormValues) {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await updateHolding(holdingId, {
          name: data.name,
          ticker: data.ticker || null,
          sector: data.sector || null,
          notes: data.notes || null,
        });
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
        ticker: currentValues.ticker ?? "",
        sector: (currentValues.sector ?? undefined) as EditHoldingFormValues["sector"],
        notes: currentValues.notes ?? "",
      });
      setServerError(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>

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

          {/* Ticker (market assets only) */}
          {isMarketAsset && (
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
            <Button type="submit" disabled={isPending || !isDirty}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
