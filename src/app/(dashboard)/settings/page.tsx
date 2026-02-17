export const dynamic = "force-dynamic";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Settings, User, Shield, Trash2 } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { WipeDataDialog } from "@/components/forms/wipe-data-dialog";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">
            Profile
          </h2>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt="Profile"
              className="h-14 w-14 rounded-full"
            />
          )}
          <div>
            <p className="font-medium text-foreground">
              {user?.fullName ?? user?.firstName ?? "User"}
            </p>
            <p className="text-sm text-muted-foreground">
              {user?.emailAddresses?.[0]?.emailAddress}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          To update your profile, avatar, or email, click the user icon in the
          top-right header and select &quot;Manage Account&quot;.
        </p>
      </section>

      {/* Security Section */}
      <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">
            Security
          </h2>
        </div>
        <p className="mt-3 text-sm text-foreground">
          Manage your password, two-factor authentication, and active sessions
          through Clerk&apos;s secure management portal.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Click the user icon in the top-right header → &quot;Manage
          Account&quot; → &quot;Security&quot; to configure MFA and review
          sessions.
        </p>
      </section>

      {/* Danger Zone */}
      <section className="mt-6 rounded-lg border border-destructive/30 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-medium text-destructive">
            Danger Zone
          </h2>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Wipe All Data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete all your portfolios, accounts, holdings, and
              transaction history. Your login account will remain active with a
              fresh start.
            </p>
          </div>
          <div className="shrink-0">
            <WipeDataDialog />
          </div>
        </div>
      </section>
    </div>
  );
}
