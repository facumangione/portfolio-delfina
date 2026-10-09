import { db } from "./db";

// Contenido editable del sitio. Los valores por defecto se usan si la clave no existe.
export const SETTING_DEFAULTS = {
  photographerName: "Delfina",
  tagline: "Fotografía de autor",
  heroText: "Luz, silencio y territorio. Un archivo de imágenes hechas sin prisa.",
  bio: "Fotógrafa con base en Mendoza. Trabajo con luz natural, paisaje y retrato, buscando imágenes que se sientan más recordadas que vistas.",
  location: "Mendoza, Argentina",
  contactEmail: "hola@delfina.photo",
  contactIntro: "Encargos, exposiciones, licencias de uso o simplemente una conversación.",
  // Redes y medios de contacto (los vacíos no se muestran en el sitio)
  instagram: "",
  whatsapp: "",
  phone: "",
  facebook: "",
  tiktok: "",
  youtube: "",
  behance: "",
  website: "",
  heroPhotoId: "",
  // Cómo se acomoda la foto de portada: auto | cover | contain (ver lib/hero.ts)
  heroFit: "auto",
  // Punto de la foto que queda siempre a la vista cuando se recorta, como "x% y%"
  heroFocus: "50% 50%",
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

/** Campos del perfil público que la fotógrafa puede editar desde su Estudio. */
export const PROFILE_KEYS = [
  "photographerName", "tagline", "bio", "location", "contactEmail", "contactIntro",
  "instagram", "whatsapp", "phone", "facebook", "tiktok", "youtube", "behance", "website",
] as const satisfies readonly SettingKey[];

export interface ContactChannel {
  label: string;
  href: string;
  text: string;
}

const pretty = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const asUrl = (value: string) => (/^https?:\/\//.test(value) ? value : `https://${value}`);

/** Convierte los datos guardados en enlaces listos para mostrar (email, WhatsApp, redes…). */
export function contactChannels(s: Settings): ContactChannel[] {
  const list: (ContactChannel | false)[] = [
    !!s.contactEmail && { label: "Email", href: `mailto:${s.contactEmail}`, text: s.contactEmail },
    !!s.whatsapp && { label: "WhatsApp", href: `https://wa.me/${s.whatsapp.replace(/\D/g, "")}`, text: s.whatsapp },
    !!s.phone && { label: "Teléfono", href: `tel:${s.phone.replace(/[^\d+]/g, "")}`, text: s.phone },
    !!s.instagram && { label: "Instagram", href: asUrl(s.instagram), text: pretty(s.instagram) },
    !!s.facebook && { label: "Facebook", href: asUrl(s.facebook), text: pretty(s.facebook) },
    !!s.tiktok && { label: "TikTok", href: asUrl(s.tiktok), text: pretty(s.tiktok) },
    !!s.youtube && { label: "YouTube", href: asUrl(s.youtube), text: pretty(s.youtube) },
    !!s.behance && { label: "Behance", href: asUrl(s.behance), text: pretty(s.behance) },
    !!s.website && { label: "Sitio web", href: asUrl(s.website), text: pretty(s.website) },
  ];
  return list.filter(Boolean) as ContactChannel[];
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const values = { ...SETTING_DEFAULTS };
  for (const row of rows) if (row.key in values) values[row.key as SettingKey] = row.value;
  return values;
}

export async function saveSettings(values: Partial<Settings>) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } }),
    ),
  );
}
