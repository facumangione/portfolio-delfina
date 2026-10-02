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
  instagram: "https://instagram.com/",
  behance: "",
  heroPhotoId: "",
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

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
