import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, Button, PanelTitle } from "@/components/panel/ui";
import { ConfirmButton } from "@/components/panel/ConfirmButton";
import { deleteMessage, toggleMessageRead } from "../actions";

export default async function MessagesPage() {
  const messages = await db.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <PanelTitle eyebrow="Estudio" title="Mensajes" />
      <div className="space-y-4">
        {messages.map((m) => (
          <article key={m.id} className={`border p-6 transition-colors ${m.read ? "border-line" : "border-accent/30 bg-white/[0.02]"}`}>
            <header className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-2xl">{m.name}</h2>
                <a href={`mailto:${m.email}`} className="text-sm text-mist hover:text-bone">{m.email}</a>
                {!m.read && <Badge tone="accent">Nuevo</Badge>}
              </div>
              <span className="eyebrow">{formatDate(m.createdAt)}</span>
            </header>
            <p className="mt-4 leading-relaxed whitespace-pre-line text-bone/85">{m.message}</p>
            <div className="mt-5 flex gap-2">
              <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: tu mensaje")}`} className="inline-flex items-center border border-bone/30 px-5 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-all duration-500 hover:bg-bone hover:text-ink">Responder</a>
              <form action={toggleMessageRead}><input type="hidden" name="id" value={m.id} /><Button variant="ghost">{m.read ? "Marcar no leído" : "Marcar leído"}</Button></form>
              <form action={deleteMessage}><input type="hidden" name="id" value={m.id} /><ConfirmButton variant="ghost" message="¿Eliminar este mensaje?">Eliminar</ConfirmButton></form>
            </div>
          </article>
        ))}
        {messages.length === 0 && <p className="py-16 text-center text-mist">No hay mensajes todavía.</p>}
      </div>
    </>
  );
}
