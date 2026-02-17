"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Pencil, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditHoldingDialog } from "@/components/forms/edit-holding-dialog";
import { useState } from "react";

interface HoldingRowActionsProps {
  holdingId: string;
  holdingName: string;
  assetType: string;
  ticker: string | null;
  sector: string | null;
  notes: string | null;
  priceInfo?: {
    priceCents: number;
    priceDollars: number | null;
    isManualOverride: boolean;
  } | null;
}

export function HoldingRowActions({
  holdingId,
  holdingName,
  assetType,
  ticker,
  sector,
  notes,
  priceInfo,
}: HoldingRowActionsProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu for {holdingName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() => router.push(`/holdings/${holdingId}`)}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push(`/holdings/${holdingId}`)}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Liquidate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog rendered outside the dropdown so it doesn't close */}
      <EditHoldingDialog
        holdingId={holdingId}
        currentValues={{
          name: holdingName,
          assetType,
          ticker,
          sector,
          notes,
        }}
        priceInfo={priceInfo}
        externalOpen={isEditOpen}
        onExternalOpenChange={setIsEditOpen}
      />
    </>
  );
}
