export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "foto";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(iso: string | Date | null | undefined, style: "long" | "short" = "long"): string {
  if (!iso) return "Sin fecha";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("es-AR", style === "long"
    ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : { month: "short", year: "numeric", timeZone: "UTC" });
}

export function megapixels(width: number, height: number): string {
  return `${((width * height) / 1_000_000).toFixed(1)} MP`;
}

// Nombre comercial de la resolución (4K, 8K...) según el lado largo
export function resolutionLabel(width: number, height: number): string {
  const long = Math.max(width, height);
  if (long >= 7680) return "8K+";
  if (long >= 5120) return "5K+";
  if (long >= 3840) return "4K";
  if (long >= 2560) return "QHD";
  return "HD";
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
