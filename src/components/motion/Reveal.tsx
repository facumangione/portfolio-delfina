"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { EASE_CINE } from "./easing";

/** Aparece suavemente (fade + desplazamiento vertical) al entrar en pantalla. */
export function Reveal({
  delay = 0,
  y = 28,
  children,
  ...rest
}: { delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1, ease: EASE_CINE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
