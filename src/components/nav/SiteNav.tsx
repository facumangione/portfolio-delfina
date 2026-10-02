"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TLink } from "@/components/motion/PageTransition";
import { EASE_CINE, EASE_IN_OUT } from "@/components/motion/easing";
import { useViewer } from "@/components/ViewerProvider";
import { logout } from "@/app/(auth)/actions";

/*
 * Navegación minimalista:
 *  - Barra superior casi invisible, que se oculta al bajar y reaparece al subir.
 *  - Botón "Menú" que abre un panel a pantalla completa donde los ítems entran
 *    uno detrás de otro (stagger) con fade + desplazamiento vertical.
 */

export function SiteNav({ brand }: { brand: string }) {
  const { viewer, favorites } = useViewer();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev && y > 160);
    setSolid(y > 40);
  });

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const items: { href: string; label: string; note?: string }[] = [
    { href: "/", label: "Inicio" },
    { href: "/galeria", label: "Galería" },
    { href: "/favoritos", label: "Favoritos", note: favorites.size ? String(favorites.size) : undefined },
    { href: "/contacto", label: "Contacto" },
  ];
  if (viewer?.role === "PHOTOGRAPHER" || viewer?.role === "ADMIN") items.push({ href: "/estudio", label: "Estudio" });
  if (viewer?.role === "ADMIN") items.push({ href: "/admin", label: "Administración" });

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        animate={{ y: hidden && !open ? "-100%" : "0%" }}
        transition={{ duration: 0.5, ease: EASE_CINE }}
      >
        <div
          className={`flex items-center justify-between px-6 py-5 transition-colors duration-700 md:px-10 ${
            solid && !open ? "bg-ink/70 backdrop-blur-xl" : "bg-transparent"
          }`}
        >
          <TLink href="/" className="font-display text-2xl tracking-wide text-bone">
            {brand}
          </TLink>
          <nav className="flex items-center gap-8">
            <div className="hidden items-center gap-8 md:flex">
              {items.slice(1, 4).map((it) => (
                <TLink
                  key={it.href}
                  href={it.href}
                  className={`eyebrow transition-colors duration-500 hover:text-bone ${pathname.startsWith(it.href) ? "text-bone!" : ""}`}
                >
                  {it.label}
                </TLink>
              ))}
            </div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="group relative z-[60] flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase"
              aria-expanded={open}
            >
              <span className="relative block h-3 w-6">
                <motion.span
                  className="absolute left-0 top-0 block h-px w-full bg-bone"
                  animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_CINE }}
                />
                <motion.span
                  className="absolute bottom-0 left-0 block h-px w-full bg-bone"
                  animate={open ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_CINE }}
                />
              </span>
              <span className="hidden sm:inline">{open ? "Cerrar" : "Menú"}</span>
            </button>
          </nav>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col justify-between bg-ink/95 px-6 pt-28 pb-10 backdrop-blur-2xl md:px-16"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.8, ease: EASE_IN_OUT }}
          >
            <motion.ul
              className="space-y-1 md:space-y-2"
              initial="hidden"
              animate="show"
              exit="hidden"
              variants={{
                show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } },
                hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
              }}
            >
              {items.map((it, i) => (
                <motion.li
                  key={it.href}
                  className="overflow-hidden"
                  variants={{
                    hidden: { opacity: 0, y: 40 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_CINE } },
                  }}
                >
                  <TLink
                    href={it.href}
                    className="group flex items-baseline gap-5 py-1 font-display text-5xl font-light text-bone/50 transition-colors duration-500 hover:text-bone md:text-7xl"
                  >
                    <span className="eyebrow w-6 text-[10px]!">{String(i + 1).padStart(2, "0")}</span>
                    <span className="inline-block transition-transform duration-700 ease-[var(--ease-cine)] group-hover:translate-x-3">
                      {it.label}
                    </span>
                    {it.note && <span className="eyebrow">{it.note}</span>}
                  </TLink>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.7, duration: 0.8 } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-6"
            >
              {viewer ? (
                <div className="flex items-center gap-6">
                  <span className="eyebrow">Sesión · {viewer.name}</span>
                  <form action={logout}>
                    <button className="eyebrow transition-colors hover:text-bone">Cerrar sesión</button>
                  </form>
                </div>
              ) : (
                <div className="flex gap-6">
                  <TLink href="/login" className="eyebrow transition-colors hover:text-bone">Ingresar</TLink>
                  <TLink href="/registro" className="eyebrow transition-colors hover:text-bone">Crear cuenta</TLink>
                </div>
              )}
              <span className="eyebrow">© {new Date().getFullYear()} {brand}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
