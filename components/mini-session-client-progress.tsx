import { Check, Circle } from "lucide-react";

export type MiniSessionClientProgressItem = {
  label: string;
};

export function MiniSessionClientProgress({
  items,
  currentIndex
}: {
  items: MiniSessionClientProgressItem[];
  currentIndex: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {items.map((item, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;

        return (
          <div
            key={`${index}-${item.label}`}
            className={`rounded-md border px-3 py-3 ${
              current
                ? "border-brass/40 bg-brass/10"
                : complete
                  ? "border-sage/25 bg-sage/10"
                  : "border-ink/10 bg-paper"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                  complete ? "bg-sage text-white" : current ? "bg-ink text-white" : "bg-white text-graphite/45"
                }`}
              >
                {complete ? <Check size={15} /> : current ? <Circle size={11} fill="currentColor" /> : <span className="text-xs font-semibold">{index + 1}</span>}
              </span>
              <span className={`text-xs font-semibold ${current ? "text-ink" : complete ? "text-sage" : "text-graphite/50"}`}>
                {item.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
