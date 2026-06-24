import { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-ink/12 bg-paper px-6 py-10 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-ink/10 bg-white text-graphite">
        {icon}
      </div>
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-graphite/70">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
