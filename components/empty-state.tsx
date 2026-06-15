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
    <div className="rounded-lg border border-dashed border-ink/15 bg-white px-5 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-paper text-graphite">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-graphite/70">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
