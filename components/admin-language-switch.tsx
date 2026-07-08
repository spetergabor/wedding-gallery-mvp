import { Languages } from "lucide-react";
import { setAdminLanguageAction } from "@/lib/admin-language-actions";
import { ADMIN_LANGUAGES, type AdminLanguage } from "@/lib/admin-language";

export function AdminLanguageSwitch({
  language,
  label,
  compact = false
}: {
  language: AdminLanguage;
  label: string;
  compact?: boolean;
}) {
  return (
    <form
      action={setAdminLanguageAction}
      className={`rounded-md border border-ink/10 bg-white/70 ${compact ? "p-2" : "p-3"}`}
      aria-label={label}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">
          <Languages size={14} />
          {label}
        </span>
        <div className="inline-grid grid-cols-3 rounded-md bg-paper p-1">
          {ADMIN_LANGUAGES.map((item) => {
            const isActive = language === item.value;

            return (
              <button
                key={item.value}
                type="submit"
                name="language"
                value={item.value}
                aria-pressed={isActive}
                className={`h-8 rounded px-2.5 text-xs font-semibold transition ${
                  isActive ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-white hover:text-ink"
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
    </form>
  );
}
