export function StatCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-ink/12 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/65">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight text-ink">{value}</p>
      <p className="mt-1 text-sm text-graphite/75">{detail}</p>
    </div>
  );
}
