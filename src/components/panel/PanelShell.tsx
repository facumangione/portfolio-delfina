"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { TLink } from "@/components/motion/PageTransition";
import { EASE_CINE } from "@/components/motion/easing";
import { cn } from "@/lib/utils";

/*
 * Estructura común de los paneles (Estudio y Administración).
 * Mantiene el lenguaje del sitio: fondo negro, tipografía editorial, líneas finas.
 * El indicador de la sección activa se desliza con layoutId.
 */
export interface PanelLink {
  href: string;
  label: string;
  badge?: number;
}

export function PanelShell({ title, links, children }: { title: string; links: PanelLink[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = links
    .filter((l) => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="min-h-[100svh] px-6 pt-28 pb-24 md:grid md:grid-cols-[220px_1fr] md:gap-16 md:px-12 md:pt-36">
      <aside className="mb-10 md:mb-0">
        <p className="eyebrow mb-6">{title}</p>
        <nav className="flex gap-6 overflow-x-auto md:flex-col md:gap-1">
          {links.map((l) => (
            <TLink
              key={l.href}
              href={l.href}
              className={cn(
                "relative flex shrink-0 items-center justify-between py-2 text-sm transition-colors duration-500 md:pl-4",
                active === l.href ? "text-bone" : "text-mist hover:text-bone",
              )}
            >
              {active === l.href && (
                <motion.span layoutId="panel-active" className="absolute top-1/2 left-0 hidden h-4 w-px -translate-y-1/2 bg-bone md:block" transition={{ duration: 0.5, ease: EASE_CINE }} />
              )}
              {l.label}
              {!!l.badge && <span className="ml-3 rounded-full bg-accent px-1.5 text-[10px] text-ink">{l.badge}</span>}
            </TLink>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
