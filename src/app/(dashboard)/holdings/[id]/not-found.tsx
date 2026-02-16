import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function HoldingNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Search className="h-7 w-7 text-muted-foreground" />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Holding not found
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This holding doesn&apos;t exist or may have been deleted. Check the URL
        or go back to your holdings list.
      </p>

      <Link
        href="/holdings"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Holdings
      </Link>
    </div>
  );
}
