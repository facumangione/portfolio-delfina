import { db } from "@/lib/db";
import { getPublishedPhotos } from "@/lib/photos";
import { contactChannels, getSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/storage";
import { Hero } from "@/components/home/Hero";
import { ParallaxImage } from "@/components/home/ParallaxImage";
import { Reveal } from "@/components/motion/Reveal";
import { TLink } from "@/components/motion/PageTransition";
import { formatDate } from "@/lib/utils";
import { focusToCss, parseHeroFit, parseHeroFocus } from "@/lib/hero";

export const dynamic = "force-dynamic";

// HOME: hero a pantalla completa → selección editorial → categorías → cierre.
export default async function HomePage() {
  const settings = await getSettings();
  // Sólo traemos lo que la portada muestra (no todo el archivo)
  const [chosen, featured] = await Promise.all([
    settings.heroPhotoId ? getPublishedPhotos({ id: settings.heroPhotoId }, 1) : Promise.resolve([]),
    getPublishedPhotos({ featured: true }, 6),
  ]);
  const hero = chosen[0] ?? featured[0] ?? (await getPublishedPhotos({}, 1))[0] ?? null;
  const selection = featured.filter((p) => p.id !== hero?.id).slice(0, 4);

  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    include: { photos: { where: { published: true }, take: 1, orderBy: [{ featured: "desc" }, { takenAt: "desc" }] }, _count: { select: { photos: { where: { published: true } } } } },
  });

  return (
    <>
      <Hero
        name={settings.photographerName}
        tagline={settings.tagline}
        text={settings.heroText}
        image={hero && { src: hero.displayUrl, blur: hero.blurDataUrl, alt: hero.title, width: hero.width, height: hero.height }}
        fit={parseHeroFit(settings.heroFit)}
        focus={focusToCss(parseHeroFocus(settings.heroFocus))}
      />

      {/* Selección editorial: fotos destacadas alternando lados */}
      <section className="px-6 pt-32 pb-24 md:px-16 md:pt-48">
        <Reveal className="mb-24 grid gap-8 md:grid-cols-12 md:mb-40">
          <p className="eyebrow md:col-span-3">Selección</p>
          <p className="font-display text-3xl leading-snug font-light text-bone/90 md:col-span-8 md:text-5xl">{settings.bio}</p>
        </Reveal>

        <div className="space-y-28 md:space-y-48">
          {selection.map((p, i) => {
            const landscape = p.width > p.height;
            const layout = landscape
              ? i % 2 ? "md:col-start-4 md:col-span-9" : "md:col-span-9"
              : i % 2 ? "md:col-start-7 md:col-span-5" : "md:col-start-2 md:col-span-5";
            return (
              <Reveal key={p.id} className="grid md:grid-cols-12">
                <TLink href={`/foto/${p.slug}`} data-cursor="Ver" className={`group block ${layout}`}>
                  <ParallaxImage src={p.displayUrl} blur={p.blurDataUrl} alt={p.title} ratio={p.width / p.height} />
                  <div className="mt-5 flex items-baseline justify-between gap-6">
                    <h3 className="font-display text-2xl font-light transition-colors duration-500 group-hover:text-accent md:text-3xl">{p.title}</h3>
                    <span className="eyebrow shrink-0">{p.category?.name} · {formatDate(p.takenAt, "short")}</span>
                  </div>
                </TLink>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Categorías */}
      <section className="border-t border-line px-6 py-28 md:px-16 md:py-40">
        <Reveal className="mb-16 flex items-end justify-between">
          <h2 className="font-display text-5xl font-light md:text-7xl">Series</h2>
          <TLink href="/galeria" className="eyebrow transition-colors hover:text-bone">Ver todo →</TLink>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.filter((c) => c.photos[0]).map((c, i) => {
            const cover = c.photos[0];
            return (
              <Reveal key={c.id} delay={(i % 3) * 0.1}>
                <TLink href={`/galeria?categoria=${c.slug}`} data-cursor="Explorar" className="group relative block aspect-[4/5] overflow-hidden bg-smoke">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrl(cover.thumbPath)} alt={c.name} loading="lazy" className="h-full w-full object-cover opacity-70 transition-all duration-[1400ms] ease-[var(--ease-cine)] group-hover:scale-105 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                    <div>
                      <h3 className="font-display text-3xl font-light">{c.name}</h3>
                      <p className="mt-1 max-h-0 overflow-hidden text-sm text-bone/70 opacity-0 transition-all duration-700 group-hover:max-h-10 group-hover:opacity-100">{c.description}</p>
                    </div>
                    <span className="eyebrow tabular-nums">{String(c._count.photos).padStart(2, "0")}</span>
                  </div>
                </TLink>
              </Reveal>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-line px-6 py-24 md:px-16">
        <Reveal className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <TLink href="/contacto" className="group font-display text-5xl font-light md:text-8xl">
            Trabajemos <em className="text-accent transition-colors duration-700 group-hover:text-bone">juntos</em>
          </TLink>
          <div className="space-y-2 text-right">
            <p className="eyebrow">{settings.location}</p>
            {contactChannels(settings).map((c) => (
              <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="block text-sm text-bone/70 transition-colors hover:text-bone">
                {c.label === "Email" ? c.text : c.label}
              </a>
            ))}
          </div>
        </Reveal>
      </footer>
    </>
  );
}
