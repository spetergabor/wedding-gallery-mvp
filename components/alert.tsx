import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const styles = {
  success: {
    box: "border-sage/25 bg-sage/10 text-sage",
    icon: CheckCircle2
  },
  error: {
    box: "border-red-200 bg-red-50 text-red-700",
    icon: AlertCircle
  },
  info: {
    box: "border-ink/10 bg-white text-graphite",
    icon: Info
  }
};

export function Alert({
  title,
  children,
  variant = "info"
}: {
  title: string;
  children?: React.ReactNode;
  variant?: keyof typeof styles;
}) {
  const Icon = styles[variant].icon;

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${styles[variant].box}`}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 shrink-0" size={17} />
        <div>
          <p className="font-medium">{title}</p>
          {children ? <div className="mt-1 opacity-80">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
