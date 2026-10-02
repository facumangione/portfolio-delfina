"use client";

import { motion } from "framer-motion";
import { EASE_CINE } from "@/components/motion/easing";

// template.tsx (a diferencia de layout.tsx) se vuelve a montar en cada navegación,
// así que es el lugar ideal para la animación de ENTRADA de cada página.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 1.01 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE_CINE }}
      style={{ transformOrigin: "50% 0%" }}
    >
      {children}
    </motion.div>
  );
}
