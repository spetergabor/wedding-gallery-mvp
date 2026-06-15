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
    <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <p className="text-sm text-graphite/70">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-ink">{value}</p>
      <p className="mt-2 text-sm text-graphite">{detail}</p>
    </div>
  );
}
