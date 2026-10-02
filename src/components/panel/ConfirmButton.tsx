"use client";

import { Button } from "./ui";

/** Botón de envío que pide confirmación antes de una acción destructiva. */
export function ConfirmButton({ message, children, variant = "danger" }: { message: string; children: React.ReactNode; variant?: "danger" | "ghost" }) {
  return (
    <Button
      variant={variant}
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
