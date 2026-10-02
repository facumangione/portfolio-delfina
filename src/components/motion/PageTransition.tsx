"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useAnimationControls } from "framer-motion";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type AnchorHTMLAttributes, type MouseEvent, type ReactNode,
} from "react";
import { EASE_IN_OUT } from "./easing";

/*
 * Transiciones entre páginas.
 *
 * El App Router de Next no anima la SALIDA de una página: cuando navegás, la
 * página vieja se reemplaza al instante. Para lograr "sale la actual, entra la
 * nueva" hacemos esto:
 *   1. <TLink> intercepta el click.
 *   2. Animamos la página actual hacia afuera (fade + leve desplazamiento + escala).
 *   3. Recién entonces llamamos a router.push().
 *   4. La página nueva entra con la animación de app/template.tsx.
 */

interface Ctx {
  navigate: (href: string) => void;
}
const TransitionContext = createContext<Ctx>({ navigate: () => {} });
export const usePageTransition = () => useContext(TransitionContext);

/** `chrome` (la navegación) queda fuera del contenedor animado: no se desvanece. */
export function PageTransitionProvider({ children, chrome }: { children: ReactNode; chrome?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const controls = useAnimationControls();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const navigate = useCallback(
    async (href: string) => {
      const target = new URL(href, window.location.href);
      if (target.pathname === window.location.pathname) {
        router.push(href);
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      router.prefetch(href);
      await controls.start({
        opacity: 0,
        y: -18,
        scale: 0.985,
        transition: { duration: 0.45, ease: EASE_IN_OUT },
      });
      window.scrollTo({ top: 0 });
      router.push(href);
    },
    [controls, router],
  );

  // Cuando cambia la ruta, el contenedor vuelve a su estado normal sin animar:
  // la animación de entrada la hace template.tsx sobre el contenido nuevo.
  useEffect(() => {
    controls.set({ opacity: 1, y: 0, scale: 1 });
    busyRef.current = false;
    setBusy(false);
  }, [pathname, controls]);

  return (
    <TransitionContext.Provider value={{ navigate }}>
      {chrome}
      {/* Línea de progreso finísima mientras se carga la página siguiente */}
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[80] h-px origin-left bg-bone/70"
        initial={false}
        animate={busy ? { scaleX: [0, 0.7], opacity: 1 } : { scaleX: 1, opacity: 0 }}
        transition={busy ? { duration: 1.6, ease: "easeOut" } : { duration: 0.5 }}
      />
      <motion.div animate={controls} initial={false} style={{ transformOrigin: "50% 0%" }}>
        {children}
      </motion.div>
    </TransitionContext.Provider>
  );
}

type TLinkProps = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode };

/** Igual que <Link>, pero con transición de salida. */
export function TLink({ href, onClick, children, ...rest }: TLinkProps) {
  const { navigate } = usePageTransition();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    // Respetamos ctrl/cmd+click (nueva pestaña) y otros casos especiales
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (rest.target && rest.target !== "_self") return;
    e.preventDefault();
    navigate(href.toString());
  };
  return (
    <Link href={href} onClick={handle} {...rest}>
      {children}
    </Link>
  );
}
