import { createCustomerAction, updateCustomerAction } from "@/lib/customer-actions";
import { Button } from "@/components/button";

type CustomerFormValue = {
  id: string;
  coupleName: string;
  primaryEmail: string;
  secondaryEmail: string | null;
  phone: string | null;
  weddingDate: Date | null;
  venue: string | null;
  status: string;
  notes: string | null;
};

const statuses = [
  { value: "lead", label: "Érdeklődő" },
  { value: "contract_pending", label: "Szerződésre vár" },
  { value: "booked", label: "Szerződött" },
  { value: "completed", label: "Teljesítve" },
  { value: "archived", label: "Archivált" }
];

function dateInputValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function CustomerForm({ customer }: { customer?: CustomerFormValue }) {
  const action = customer ? updateCustomerAction.bind(null, customer.id) : createCustomerAction;

  return (
    <form action={action} className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-graphite">Pár neve</span>
          <input
            name="coupleName"
            defaultValue={customer?.coupleName ?? ""}
            required
            placeholder="pl. Esther und Oliver"
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Elsődleges email</span>
          <input
            name="primaryEmail"
            type="email"
            defaultValue={customer?.primaryEmail ?? ""}
            required
            placeholder="email@example.com"
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Másodlagos email</span>
          <input
            name="secondaryEmail"
            type="email"
            defaultValue={customer?.secondaryEmail ?? ""}
            placeholder="opcionális"
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Telefon</span>
          <input
            name="phone"
            defaultValue={customer?.phone ?? ""}
            placeholder="+43 ..."
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Esküvő dátuma</span>
          <input
            name="weddingDate"
            type="date"
            defaultValue={dateInputValue(customer?.weddingDate)}
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Helyszín</span>
          <input
            name="venue"
            defaultValue={customer?.venue ?? ""}
            placeholder="pl. Graz, Schlossberg, ..."
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Státusz</span>
          <select
            name="status"
            defaultValue={customer?.status ?? "lead"}
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-graphite">Megjegyzések</span>
          <textarea
            name="notes"
            defaultValue={customer?.notes ?? ""}
            rows={6}
            placeholder="Belső jegyzetek: csomag, fontos kérések, szerződéses megállapodások..."
            className="w-full rounded-md border border-ink/15 bg-paper px-3 py-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit">{customer ? "Ügyfél mentése" : "Ügyfél létrehozása"}</Button>
      </div>
    </form>
  );
}
