"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { CUSTODIANS, ACCOUNT_TYPES } from "@/lib/constants";
import { updateAccount } from "@/server/actions/accounts";

// ─── Form Schema ────────────────────────────────────────────────────

const editAccountFormSchema = z.object({
  name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name must be 100 characters or fewer"),
  custodian: z.enum(Object.keys(CUSTODIANS) as [string, ...string[]], {
    message: "Please select a custodian",
  }),
  accountType: z.enum(Object.keys(ACCOUNT_TYPES) as [string, ...string[]], {
    message: "Please select an account type",
  }),
  notes: z.string().max(1000, "Notes must be 1000 characters or fewer").optional(),
});

type EditAccountFormValues = z.infer<typeof editAccountFormSchema>;

// ─── Dropdown entries ───────────────────────────────────────────────

const custodianEntries = Object.entries(CUSTODIANS).map(([key, label]) => ({
  value: key,
  label,
}));

const accountTypeEntries = Object.entries(ACCOUNT_TYPES).map(([key, label]) => ({
  value: key,
  label,
}));

// ─── Component ──────────────────────────────────────────────────────

interface EditAccountDialogProps {
  accountId: string;
  currentValues: {
    name: string;
    custodian: string;
    accountType: string;
    notes?: string | null;
  };
}

export function EditAccountDialog({
  accountId,
  currentValues,
}: EditAccountDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [custodianOpen, setCustodianOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditAccountFormValues>({
    resolver: zodResolver(editAccountFormSchema),
    defaultValues: {
      name: currentValues.name,
      custodian: currentValues.custodian as EditAccountFormValues["custodian"],
      accountType: currentValues.accountType as EditAccountFormValues["accountType"],
      notes: currentValues.notes ?? "",
    },
  });

  const selectedCustodian = watch("custodian");
  const selectedAccountType = watch("accountType");

  function onSubmit(data: EditAccountFormValues) {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await updateAccount(accountId, {
          name: data.name,
          custodian: data.custodian,
          accountType: data.accountType,
          notes: data.notes || null,
        });
        if (result.success) {
          setIsOpen(false);
        }
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to update account",
        );
      }
    });
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      reset({
        name: currentValues.name,
        custodian: currentValues.custodian as EditAccountFormValues["custodian"],
        accountType: currentValues.accountType as EditAccountFormValues["accountType"],
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
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Update the details for this account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          {/* Account Name */}
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Account Name</Label>
            <Input
              id="edit-name"
              placeholder='e.g. "Schwab IRA" or "Coinbase"'
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Custodian — Searchable Combobox */}
          <div className="grid gap-2">
            <Label>Custodian</Label>
            <Popover open={custodianOpen} onOpenChange={setCustodianOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={custodianOpen}
                  className={cn(
                    "w-full justify-between font-normal",
                    !selectedCustodian && "text-muted-foreground",
                  )}
                >
                  {selectedCustodian
                    ? custodianEntries.find((c) => c.value === selectedCustodian)
                        ?.label
                    : "Select custodian..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search custodians..." />
                  <CommandList>
                    <CommandEmpty>No custodian found.</CommandEmpty>
                    <CommandGroup>
                      {custodianEntries.map((c) => (
                        <CommandItem
                          key={c.value}
                          value={c.label}
                          onSelect={() => {
                            setValue(
                              "custodian",
                              c.value as EditAccountFormValues["custodian"],
                              { shouldValidate: true, shouldDirty: true },
                            );
                            setCustodianOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustodian === c.value
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {c.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.custodian && (
              <p className="text-xs text-destructive">
                {errors.custodian.message}
              </p>
            )}
          </div>

          {/* Account Type */}
          <div className="grid gap-2">
            <Label htmlFor="edit-accountType">Account Type</Label>
            <Select
              value={selectedAccountType}
              onValueChange={(val) =>
                setValue(
                  "accountType",
                  val as EditAccountFormValues["accountType"],
                  { shouldValidate: true, shouldDirty: true },
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {accountTypeEntries.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountType && (
              <p className="text-xs text-destructive">
                {errors.accountType.message}
              </p>
            )}
          </div>

          {/* Notes (optional) */}
          <div className="grid gap-2">
            <Label htmlFor="edit-notes">
              Notes{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="edit-notes"
              placeholder="Any extra details about this account..."
              rows={3}
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>

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
