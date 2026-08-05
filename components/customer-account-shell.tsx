import Link from "next/link";
import type { ReactNode } from "react";
import { Camera, LogOut, ShieldCheck } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { logoutCustomerPortalAction } from "@/lib/customer-portal-account-actions";

export function CustomerAccountShell({
  coupleName,
  displayName,
  language,
  children
}: {
  coupleName: string;
  displayName: string | null;
  language: string;
  children: ReactNode;
}) {
  const german = language !== "hu";

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/portal/account" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-ink text-white"><Camera size={19} /></span>
            <span>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">
                <ShieldCheck size={12} /> {german ? "Geschützter Paarbereich" : "Védett pár-felület"}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-ink">{coupleName}</span>
            </span>
          </Link>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {displayName ? <span className="text-xs text-graphite/60">{displayName}</span> : null}
            <form action={logoutCustomerPortalAction}>
              <FormSubmitButton variant="ghost" pendingLabel={german ? "Abmelden..." : "Kilépés..."}>
                <LogOut size={15} /> {german ? "Abmelden" : "Kilépés"}
              </FormSubmitButton>
            </form>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
