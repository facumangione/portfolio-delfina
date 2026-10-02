import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { ContactForm } from "@/components/forms/ContactForm";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = { title: "Contacto" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const links = [
    { label: "Email", href: `mailto:${s.contactEmail}`, text: s.contactEmail },
    s.instagram && { label: "Instagram", href: s.instagram, text: s.instagram.replace(/^https?:\/\/(www\.)?/, "") },
    s.behance && { label: "Behance", href: s.behance, text: s.behance.replace(/^https?:\/\/(www\.)?/, "") },
  ].filter(Boolean) as { label: string; href: string; text: string }[];

  return (
    <div className="grid min-h-[100svh] gap-20 px-6 pt-36 pb-24 md:grid-cols-12 md:px-16 md:pt-44">
      <div className="md:col-span-5">
        <Reveal>
          <p className="eyebrow mb-5">Contacto</p>
          <h1 className="font-display text-6xl leading-[0.95] font-light md:text-8xl">
            Hablemos de <em className="text-accent">imágenes</em>
          </h1>
          <p className="mt-8 max-w-sm leading-relaxed text-mist">{s.contactIntro}</p>
        </Reveal>
        <Reveal delay={0.2} className="mt-16 space-y-5">
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="group flex items-baseline justify-between gap-6 border-b border-line pb-4">
              <span className="eyebrow">{l.label}</span>
              <span className="text-sm text-bone/70 transition-all duration-500 group-hover:-translate-x-1 group-hover:text-bone">{l.text} ↗</span>
            </a>
          ))}
          <p className="eyebrow pt-4">{s.location}</p>
        </Reveal>
      </div>
      <Reveal delay={0.15} className="md:col-span-6 md:col-start-7 md:pt-24">
        <ContactForm defaultName={user?.name} defaultEmail={user?.email} />
      </Reveal>
    </div>
  );
}
