import clsx from "clsx";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { locales, type Localized } from "@/i18n/config";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl font-medium">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mocha">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={clsx("rounded-2xl border border-line bg-porcelain p-5 shadow-soft sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mocha">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const statusStyles: Record<string, string> = {
  confirmed: "bg-success/10 text-success",
  pending: "bg-warning/15 text-warning",
  completed: "bg-espresso/8 text-espresso",
  cancelled: "bg-danger/10 text-danger",
  no_show: "bg-danger/10 text-danger",
  sent: "bg-success/10 text-success",
  queued: "bg-cream text-mocha",
  failed: "bg-danger/10 text-danger",
  skipped: "bg-warning/15 text-warning",
};
export function Badge({ status, label }: { status: string; label: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", statusStyles[status] ?? "bg-cream text-mocha")}>
      {label}
    </span>
  );
}

export function Flash({ saved, error, savedText }: { saved?: string; error?: string; savedText: string }) {
  if (!saved && !error) return null;
  return (
    <div role="status" className={clsx("mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm", error ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
      {error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
      {error ?? savedText}
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-mocha">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-taupe">{hint}</span>}
    </label>
  );
}

/** Three inputs (TR / EN / DE) for translatable content */
export function LocalizedInput({ name, label, value, textarea, required }: { name: string; label: string; value?: Localized | null; textarea?: boolean; required?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-1 block text-xs font-semibold text-mocha">{label}</legend>
      <div className="space-y-2">
        {locales.map((l) => (
          <div key={l} className="flex items-start gap-2">
            <span className="mt-2 w-7 shrink-0 text-[10px] font-bold uppercase tracking-wider text-taupe">{l}</span>
            {textarea ? (
              <textarea name={`${name}.${l}`} defaultValue={value?.[l] ?? ""} rows={2} className="input-sm" required={required && l === "tr"} />
            ) : (
              <input name={`${name}.${l}`} defaultValue={value?.[l] ?? ""} className="input-sm" required={required && l === "tr"} />
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-taupe">{children}</p>;
}
