import { cn } from "@/lib/utils";

/*
 * Campo de formulario "editorial": sin cajas, sólo una línea inferior que se
 * ilumina al enfocar, y la etiqueta en pequeño encima.
 */
type FieldProps = {
  label: string;
  name: string;
  textarea?: boolean;
  className?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field({ label, name, textarea, className, hint, ...rest }: FieldProps) {
  const base =
    "peer w-full border-0 border-b border-white/15 bg-transparent px-0 py-3 text-base text-bone placeholder:text-white/20 transition-colors duration-500 focus:border-bone focus:outline-none";
  return (
    <label className={cn("group block", className)}>
      <span className="eyebrow block transition-colors group-focus-within:text-bone">{label}</span>
      {textarea ? (
        <textarea name={name} rows={5} className={cn(base, "resize-none")} {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input name={name} className={base} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && <span className="mt-2 block text-xs text-mist">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ children, pending, className }: { children: React.ReactNode; pending?: boolean; className?: string }) {
  return (
    <button
      disabled={pending}
      className={cn(
        "group inline-flex items-center gap-4 border border-bone/30 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all duration-700 hover:border-bone hover:bg-bone hover:text-ink disabled:opacity-40",
        className,
      )}
    >
      {pending ? "Enviando…" : children}
      <span className="inline-block transition-transform duration-700 group-hover:translate-x-1.5">→</span>
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-300/90">{message}</p>;
}
