"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/** Imagen con parallax muy sutil: se desplaza un ±6% mientras cruza la pantalla. */
export function ParallaxImage({ src, blur, alt, ratio }: { src: string; blur: string; alt: string; ratio: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  return (
    <div ref={ref} className="relative overflow-hidden bg-smoke" style={{ aspectRatio: ratio, backgroundImage: `url(${blur})`, backgroundSize: "cover" }}>
      <motion.div className="absolute -inset-[7%]" style={{ y }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1600ms] ease-[var(--ease-cine)] group-hover:scale-[1.03]" />
      </motion.div>
    </div>
  );
}
