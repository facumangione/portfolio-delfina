"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { TLink } from "@/components/motion/PageTransition";
import { EASE_CINE } from "@/components/motion/easing";
import { displaySize, resolveHeroFit, type HeroFit } from "@/lib/hero";

/*
 * Hero cinematográfico:
 *  - Al cargar, la foto hace un "zoom out" lento (escala 1.15 → 1) mientras aparece.
 *  - El nombre entra letra por letra.
 *  - Al hacer scroll: la foto se desplaza más lento que la página (parallax sutil)
 *    y se oscurece, y el texto sube y se desvanece, dando paso a la galería.
 *  - La foto se adapta a la pantalla (ver lib/hero.ts): si tiene una forma
 *    parecida la llena ("cover", centrada en el punto de enfoque elegido en
 *    Administración → Contenido); si no (una vertical en una pantalla ancha, o
 *    una foto chica que se vería pixelada) se muestra ENTERA ("contain") sobre
 *    un fondo hecho con la misma foto desenfocada y oscurecida.
 */
export interface HeroImage {
  src: string;
  blur: string;
  alt: string;
  width: number;
  height: number;
}

export function Hero({
  name, tagline, text, image, fit = "auto", focus = "50% 50%",
}: { name: string; tagline: string; text: string; image: HeroImage | null; fit?: HeroFit; focus?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState(false);
  // Medidas del hero (= la ventana). Hasta medirlas no sabemos cómo acomodar la foto,
  // así que la foto recién aparece cuando está cargada Y medida.
  const [screen, setScreen] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScreen({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const mode = image && screen ? resolveHeroFit(fit, image, screen) : null;
  const ready = loaded && mode !== null;
  const shown = image ? displaySize(image.width, image.height) : null;
  const vertical = image ? image.height >= image.width : false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const shade = useTransform(scrollYProgress, [0, 1], [0.25, 0.85]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[560px] overflow-hidden">
      <motion.div className="absolute inset-0" style={{ y: imageY, scale: imageScale }}>
        {image && (
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.15, opacity: 0 }}
            animate={ready ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 2.6, ease: EASE_CINE }}
            style={mode === "contain" ? undefined : { backgroundImage: `url(${image.blur})`, backgroundSize: "cover", backgroundPosition: focus }}
          >
            {mode === "contain" && (
              // Fondo ambientado: la misma foto (su versión diminuta de 16px) muy desenfocada y oscura
              <div
                aria-hidden
                className="absolute -inset-[10%]"
                style={{ backgroundImage: `url(${image.blur})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(48px) brightness(0.6) saturate(1.2)" }}
              />
            )}
            <div
              className={
                mode !== "contain"
                  ? "absolute inset-0"
                  : vertical
                    // Vertical: arriba en el celular (el texto va abajo), a la derecha en la computadora (el nombre va a la izquierda)
                    ? "absolute inset-x-6 top-24 bottom-[46%] flex items-center justify-center md:top-24 md:bottom-[18%] md:left-[42%] md:right-16 md:justify-end"
                    // Horizontal (chica o muy panorámica): centrada en la parte de arriba
                    : "absolute inset-x-6 top-24 bottom-[46%] flex items-center justify-center md:inset-x-16 md:bottom-[38%]"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                onLoad={() => setLoaded(true)}
                ref={(el) => { if (el?.complete) setLoaded(true); }}
                fetchPriority="high"
                className={mode === "contain" ? "min-h-0 object-contain shadow-[0_30px_100px_rgba(0,0,0,0.55)]" : "h-full w-full object-cover"}
                // En "contain" nunca la agrandamos más que su tamaño real (así no se pixela)
                style={mode === "contain" ? { maxWidth: `min(100%, ${shown?.width}px)`, maxHeight: `min(100%, ${shown?.height}px)` } : { objectPosition: focus }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: shade }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />

      <motion.div style={{ y: textY, opacity: textOpacity }} className="relative z-10 flex h-full flex-col justify-end px-6 pb-20 md:px-16 md:pb-24">
        <motion.p
          className="eyebrow mb-6 text-bone/70!"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9, ease: EASE_CINE }}
        >
          {tagline}
        </motion.p>
        <h1 className="font-display text-[clamp(4rem,14vw,13rem)] leading-[0.85] font-light tracking-tight">
          {name.split("").map((char, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom">
              <motion.span
                className="inline-block"
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.3, delay: 0.3 + i * 0.06, ease: EASE_CINE }}
              >
                {char === " " ? " " : char}
              </motion.span>
            </span>
          ))}
        </h1>
        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <motion.p
            className="max-w-md text-sm leading-relaxed text-bone/70 md:text-base"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 1.2, ease: EASE_CINE }}
          >
            {text}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, delay: 1.4, ease: EASE_CINE }}>
            <TLink
              href="/galeria"
              className="group inline-flex items-center gap-5 border border-bone/25 px-7 py-4 text-[11px] tracking-[0.25em] uppercase backdrop-blur-sm transition-all duration-700 hover:border-bone hover:bg-bone hover:text-ink"
            >
              Explorar el portfolio
              <span className="inline-block transition-transform duration-700 group-hover:translate-x-1.5">→</span>
            </TLink>
          </motion.div>
        </div>
      </motion.div>

      {/* Indicador de scroll */}
      <motion.div
        className="absolute bottom-6 left-1/2 z-10 hidden h-10 w-px overflow-hidden bg-white/15 md:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        <motion.span
          className="block h-1/2 w-full bg-bone"
          animate={{ y: ["-100%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </section>
  );
}
