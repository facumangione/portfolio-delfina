"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionState } from "react";
import { sendContact } from "@/app/contacto/actions";
import { Field, FormError, SubmitButton } from "./Field";
import { EASE_CINE } from "@/components/motion/easing";

export function ContactForm({ defaultName = "", defaultEmail = "" }: { defaultName?: string; defaultEmail?: string }) {
  const [state, action, pending] = useActionState(sendContact, undefined);
  return (
    <AnimatePresence mode="wait">
      {state?.ok ? (
        <motion.div key="ok" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE_CINE }}>
          <p className="font-display text-5xl font-light">Gracias.</p>
          <p className="mt-4 text-mist">Tu mensaje llegó. Te respondo a la brevedad.</p>
        </motion.div>
      ) : (
        <motion.form key="form" action={action} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} className="space-y-10">
          <div className="grid gap-10 md:grid-cols-2">
            <Field label="Nombre" name="name" required defaultValue={defaultName} autoComplete="name" />
            <Field label="Email" name="email" type="email" required defaultValue={defaultEmail} autoComplete="email" />
          </div>
          <Field label="Mensaje" name="message" textarea required placeholder="Contame sobre tu proyecto…" />
          <FormError message={state?.error} />
          <SubmitButton pending={pending}>Enviar mensaje</SubmitButton>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
