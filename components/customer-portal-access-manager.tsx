"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  saveCustomerPortalAccountAction,
  setCustomerPortalAccountStatusAction
} from "@/lib/customer-portal-account-actions";

type PortalAccount = {
  id: string;
  loginIdentifier: string;
  email: string | null;
  displayName: string | null;
  status: string;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessionCount: number;
};

const fieldClass = "h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-graphite/40 focus:border-ink/50";

function generateTemporaryPassword() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => characters[value % characters.length]).join("");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Még nem lépett be";
  }

  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function PasswordField({
  value,
  onChange,
  required
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function generate() {
    onChange(generateTemporaryPassword());
    setCopied(false);
  }

  async function copy() {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          name="password"
          type="text"
          minLength={10}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={required ? "Legalább 10 karakter" : "Üresen hagyva nem változik"}
          autoComplete="off"
          className={`${fieldClass} font-mono`}
        />
        <button
          type="button"
          onClick={generate}
          title="Biztonságos jelszó generálása"
          aria-label="Biztonságos jelszó generálása"
          className="grid size-11 shrink-0 place-items-center rounded-md border border-ink/15 bg-white text-ink transition hover:bg-paper"
        >
          <RefreshCw size={16} />
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!value}
          title="Jelszó másolása"
          aria-label="Jelszó másolása"
          className="grid size-11 shrink-0 place-items-center rounded-md border border-ink/15 bg-white text-ink transition hover:bg-paper disabled:opacity-35"
        >
          {copied ? <Check size={16} className="text-sage" /> : <Copy size={16} />}
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-graphite/60">
        Mentés után a jelszó többé nem olvasható ki. Másold ki és biztonságosan add át a párnak.
      </p>
    </div>
  );
}

function ExistingAccountForm({ customerId, account }: { customerId: string; account: PortalAccount }) {
  const [password, setPassword] = useState("");
  const active = account.status === "active";

  return (
    <article className="rounded-md border border-ink/10 bg-paper p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-ink">{account.displayName || account.loginIdentifier}</h4>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${active ? "bg-sage/10 text-sage" : "bg-ink/10 text-graphite"}`}>
              {active ? "Aktív" : "Letiltva"}
            </span>
            {account.mustChangePassword ? (
              <span className="rounded-full bg-brass/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brass">Jelszócsere szükséges</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-graphite/70">Belépési név: <span className="font-medium text-ink">{account.loginIdentifier}</span></p>
          <p className="mt-1 text-xs text-graphite/55">Utolsó belépés: {formatDate(account.lastLoginAt)} · {account.activeSessionCount} aktív eszköz</p>
        </div>
        <form action={setCustomerPortalAccountStatusAction.bind(null, customerId, account.id, !active)}>
          <FormSubmitButton variant="secondary" pendingLabel="Mentés...">
            {active ? "Hozzáférés letiltása" : "Hozzáférés engedélyezése"}
          </FormSubmitButton>
        </form>
      </div>

      <form action={saveCustomerPortalAccountAction.bind(null, customerId, account.id)} className="mt-4 grid gap-3 border-t border-ink/10 pt-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-graphite">Megjelenő név</span>
          <input name="displayName" defaultValue={account.displayName ?? ""} className={fieldClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-graphite">E-mail vagy felhasználónév</span>
          <input name="loginIdentifier" required defaultValue={account.loginIdentifier} autoCapitalize="none" className={fieldClass} />
        </label>
        {!account.loginIdentifier.includes("@") ? (
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-xs font-medium text-graphite">Kapcsolattartó e-mail – opcionális</span>
            <input name="email" type="email" defaultValue={account.email ?? ""} className={fieldClass} />
          </label>
        ) : <input type="hidden" name="email" value={account.email ?? ""} />}
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium text-graphite">Új ideiglenes jelszó – csak visszaállításhoz</span>
          <PasswordField value={password} onChange={setPassword} />
        </label>
        <div className="flex justify-end md:col-span-2">
          <FormSubmitButton pendingLabel="Mentés...">Fiók adatainak mentése</FormSubmitButton>
        </div>
      </form>
    </article>
  );
}

export function CustomerPortalAccessManager({
  customerId,
  coupleName,
  primaryEmail,
  loginUrl,
  accounts
}: {
  customerId: string;
  coupleName: string;
  primaryEmail: string;
  loginUrl: string;
  accounts: PortalAccount[];
}) {
  const [newPassword, setNewPassword] = useState("");

  return (
    <section className="mt-6 rounded-md border border-ink/10 bg-white p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-graphite/55">
            <ShieldCheck size={15} /> Biztonságos belépés
          </p>
          <h3 className="mt-2 text-lg font-semibold text-ink">Pár-admin hozzáférések</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/65">
            A pár csak a hozzájuk rendelt vendéggalériákat látja. Jóváhagyhatnak, elrejthetnek, lomtárba helyezhetnek és visszaállíthatnak képeket.
          </p>
        </div>
        <CopyLinkButton url={loginUrl} label="Belépési link másolása" />
      </div>

      <div className="mt-4 rounded-md border border-ink/10 bg-paper px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.13em] text-graphite/50">Belépési oldal</p>
        <p className="mt-1 break-all text-sm font-medium text-ink">{loginUrl}</p>
      </div>

      {accounts.length > 0 ? (
        <div className="mt-4 space-y-3">
          {accounts.map((account) => (
            <ExistingAccountForm key={account.id} customerId={customerId} account={account} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-center text-sm text-graphite/65">
          A párnak még nincs jelszavas hozzáférése.
        </p>
      )}

      <form action={saveCustomerPortalAccountAction.bind(null, customerId, null)} className="mt-5 rounded-md border border-sage/20 bg-sage/5 p-4">
        <h4 className="flex items-center gap-2 font-semibold text-ink"><UserPlus size={17} /> Új hozzáférés létrehozása</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-graphite">Megjelenő név</span>
            <input name="displayName" defaultValue={coupleName} className={fieldClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-graphite">E-mail vagy felhasználónév</span>
            <input name="loginIdentifier" required defaultValue={primaryEmail} autoCapitalize="none" className={fieldClass} />
          </label>
          <input type="hidden" name="email" value={primaryEmail} />
          <label className="block space-y-1.5 md:col-span-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-graphite"><KeyRound size={13} /> Ideiglenes jelszó</span>
            <PasswordField value={newPassword} onChange={setNewPassword} required />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <FormSubmitButton pendingLabel="Létrehozás...">Hozzáférés létrehozása</FormSubmitButton>
        </div>
      </form>
    </section>
  );
}
