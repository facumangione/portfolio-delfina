import { cn } from "@/lib/utils";

// Piezas visuales reutilizadas en los paneles.

export function PanelTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
      <div>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-display text-5xl font-light md:text-6xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="border-t border-line pt-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 text-4xl font-extralight tracking-tight tabular-nums">{value}</p>
      {note && <p className="mt-2 text-xs text-mist">{note}</p>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "accent"; children: React.ReactNode }) {
  const tones = {
    neutral: "border-line text-mist",
    ok: "border-emerald-400/30 text-emerald-300/90",
    warn: "border-amber-400/30 text-amber-300/90",
    accent: "border-accent/40 text-accent",
  };
  return <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-[10px] tracking-[0.15em] uppercase", tones[tone])}>{children}</span>;
}

export const inputClass =
  "w-full border-0 border-b border-white/15 bg-transparent px-0 py-2.5 text-sm text-bone placeholder:text-white/25 transition-colors focus:border-bone focus:outline-none";

export const selectClass =
  "w-full appearance-none border-0 border-b border-white/15 bg-transparent px-0 py-2.5 text-sm text-bone focus:border-bone focus:outline-none [&>option]:bg-coal";

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("eyebrow mb-1 block", className)}>{children}</span>;
}

export function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-4">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border border-white/20 transition-colors duration-500 peer-checked:border-bone peer-checked:bg-bone after:absolute after:top-1/2 after:left-0.5 after:h-3.5 after:w-3.5 after:-translate-y-1/2 after:rounded-full after:bg-mist after:transition-all after:duration-500 peer-checked:after:left-[18px] peer-checked:after:bg-ink" />
      <span>
        <span className="block text-sm text-bone">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-mist">{hint}</span>}
      </span>
    </label>
  );
}

export function Button({ children, variant = "primary", className, ...rest }: { variant?: "primary" | "ghost" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "border-bone/30 hover:border-bone hover:bg-bone hover:text-ink",
    ghost: "border-transparent text-mist hover:text-bone",
    danger: "border-red-400/30 text-red-300/90 hover:border-red-300 hover:bg-red-400/10",
  };
  return (
    <button className={cn("inline-flex items-center gap-3 border px-5 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-all duration-500 disabled:opacity-40", variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}
