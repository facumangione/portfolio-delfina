import { Reveal } from "@/components/motion/Reveal";

/** Encabezado editorial común de las páginas interiores. */
export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Reveal className="mb-14 md:mb-20">
      <p className="eyebrow mb-5">{eyebrow}</p>
      <h1 className="font-display text-6xl leading-none font-light md:text-8xl">{title}</h1>
      {children && <div className="mt-6 max-w-xl text-sm leading-relaxed text-mist">{children}</div>}
    </Reveal>
  );
}
