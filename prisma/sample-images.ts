// Generador de fotografías de ejemplo.
// Crea "escenas" en SVG (paisajes, retratos en silueta, arquitectura, ciudad
// nocturna, naturaleza) y las rasteriza con sharp a JPG de alta resolución,
// para poder probar el portfolio sin depender de imágenes externas.
// Reemplazalas subiendo fotos reales desde el panel de la fotógrafa.

import sharp from "sharp";

type Rand = () => number;
function rng(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = <T,>(r: Rand, arr: T[]) => arr[Math.floor(r() * arr.length)];

const PALETTES = {
  dusk: ["#0b0d17", "#2a2340", "#7a4a63", "#e0896b", "#f6c89f"],
  dawn: ["#10161f", "#33475b", "#8aa0b0", "#d9c7b0", "#f2e6d8"],
  mono: ["#050505", "#1c1c1c", "#4a4a4a", "#9a9a9a", "#e8e8e8"],
  forest: ["#060a08", "#16251d", "#3b5443", "#8fa58c", "#dfe6d6"],
  ember: ["#0a0604", "#2b1208", "#7a2e12", "#d0682c", "#f7c26b"],
  sea: ["#04090f", "#0d2233", "#2f5870", "#8fb4c4", "#e6eef0"],
};
type PaletteName = keyof typeof PALETTES;

// Textura de grano fotográfico: un mosaico de ruido que se repite sobre la imagen.
let grainTile: Buffer | null = null;
async function grain() {
  if (grainTile) return grainTile;
  const size = 512;
  const r = rng(42);
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(r() * 255);
    px.set([v, v, v, 22], i * 4);
  }
  grainTile = await sharp(px, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
  return grainTile;
}

const vignette = `<radialGradient id="vig" cx="50%" cy="50%" r="75%">
  <stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></radialGradient>`;

function ridge(r: Rand, w: number, h: number, base: number, amp: number, steps: number) {
  let d = `M0 ${h} L0 ${base}`;
  let y = base;
  for (let i = 1; i <= steps; i++) {
    y = Math.max(base - amp, Math.min(base + amp * 0.4, y + (r() - 0.55) * amp * 0.6));
    d += ` L${(w * i) / steps} ${y.toFixed(1)}`;
  }
  return d + ` L${w} ${h} Z`;
}

function landscape(r: Rand, w: number, h: number, p: string[]) {
  const sunX = w * (0.25 + r() * 0.5);
  const sunY = h * (0.3 + r() * 0.2);
  const layers = [0, 1, 2, 3].map((i) => {
    const base = h * (0.5 + i * 0.1);
    const col = [p[2], p[1], p[1], p[0]][i];
    return `<path d="${ridge(r, w, h, base, h * (0.18 - i * 0.03), 40 + i * 20)}" fill="${col}" opacity="${0.75 + i * 0.08}"/>
      <rect x="0" y="${base - h * 0.08}" width="${w}" height="${h * 0.14}" fill="url(#fog)" opacity="${0.35 - i * 0.07}"/>`;
  });
  return `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="0.55" stop-color="${p[3]}"/><stop offset="1" stop-color="${p[4]}"/></linearGradient>
    <radialGradient id="sun"><stop offset="0" stop-color="${p[4]}"/><stop offset="0.25" stop-color="${p[4]}" stop-opacity="0.9"/><stop offset="1" stop-color="${p[3]}" stop-opacity="0"/></radialGradient>
    <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[4]}" stop-opacity="0"/><stop offset="0.5" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[4]}" stop-opacity="0"/></linearGradient>
    ${vignette}</defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${Math.min(w, h) * 0.35}" fill="url(#sun)"/>
    ${layers.join("")}`;
}

function sea(r: Rand, w: number, h: number, p: string[]) {
  const horizon = h * (0.45 + r() * 0.15);
  const sunX = w * (0.3 + r() * 0.4);
  const lines = Array.from({ length: 60 }, (_, i) => {
    const y = horizon + ((h - horizon) * i) / 60 + r() * 4;
    const len = w * (0.02 + r() * 0.12) * (1 + i / 30);
    return `<rect x="${sunX - len / 2 + (r() - 0.5) * w * 0.08}" y="${y}" width="${len}" height="${1.5 + i / 15}" fill="${p[4]}" opacity="${0.15 + r() * 0.35}"/>`;
  });
  return `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="0.7" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[3]}"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>
    <radialGradient id="sun"><stop offset="0" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[4]}" stop-opacity="0"/></radialGradient>
    ${vignette}</defs>
    <rect width="${w}" height="${horizon}" fill="url(#sky)"/>
    <circle cx="${sunX}" cy="${horizon}" r="${w * 0.12}" fill="url(#sun)"/>
    <rect y="${horizon}" width="${w}" height="${h - horizon}" fill="url(#water)"/>
    ${lines.join("")}`;
}

function portrait(r: Rand, w: number, h: number, p: string[]) {
  const cx = w * (0.4 + r() * 0.2);
  const headR = w * 0.13;
  const headY = h * 0.42;
  const lightX = r() > 0.5 ? w * 0.15 : w * 0.85;
  return `<defs>
    <radialGradient id="light" cx="${lightX / w}" cy="0.3" r="0.9"><stop offset="0" stop-color="${p[3]}"/><stop offset="0.5" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></radialGradient>
    <linearGradient id="rim" x1="${lightX < w / 2 ? 0 : 1}" y1="0" x2="${lightX < w / 2 ? 1 : 0}" y2="0"><stop offset="0" stop-color="${p[4]}" stop-opacity="0.8"/><stop offset="0.25" stop-color="${p[0]}" stop-opacity="0"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="${w * 0.004}"/></filter>
    ${vignette}</defs>
    <rect width="${w}" height="${h}" fill="url(#light)"/>
    <g filter="url(#soft)">
      <path d="M${cx - w * 0.36} ${h} C${cx - w * 0.34} ${h * 0.68} ${cx - w * 0.16} ${h * 0.6} ${cx} ${h * 0.6} C${cx + w * 0.16} ${h * 0.6} ${cx + w * 0.34} ${h * 0.68} ${cx + w * 0.36} ${h} Z" fill="${p[0]}"/>
      <rect x="${cx - headR * 0.45}" y="${headY + headR * 0.6}" width="${headR * 0.9}" height="${h * 0.12}" fill="${p[0]}"/>
      <ellipse cx="${cx}" cy="${headY}" rx="${headR}" ry="${headR * 1.25}" fill="${p[0]}"/>
      <ellipse cx="${cx}" cy="${headY}" rx="${headR}" ry="${headR * 1.25}" fill="url(#rim)"/>
    </g>`;
}

function architecture(r: Rand, w: number, h: number, p: string[]) {
  const shapes: string[] = [];
  const cols = 5 + Math.floor(r() * 6);
  for (let i = 0; i < cols; i++) {
    const x = (w / cols) * i;
    const top = h * (0.1 + r() * 0.5);
    shapes.push(`<rect x="${x}" y="${top}" width="${w / cols - w * 0.01}" height="${h - top}" fill="${pick(r, [p[1], p[2], p[0]])}"/>`);
    shapes.push(`<polygon points="${x},${top} ${x + w / cols * 0.6},${top} ${x},${h}" fill="${p[0]}" opacity="0.45"/>`);
    for (let j = 0; j < 14; j++) {
      const wy = top + (h - top) * (j / 14);
      shapes.push(`<rect x="${x + w * 0.01}" y="${wy}" width="${w / cols - w * 0.03}" height="${h * 0.004}" fill="${p[3]}" opacity="${0.15 + r() * 0.2}"/>`);
    }
  }
  return `<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>${vignette}</defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>${shapes.join("")}`;
}

function city(r: Rand, w: number, h: number, p: string[]) {
  const bokeh = Array.from({ length: 70 }, () => {
    const rad = w * (0.01 + r() * 0.05);
    return `<circle cx="${r() * w}" cy="${h * (0.2 + r() * 0.7)}" r="${rad}" fill="${pick(r, [p[3], p[4], p[2]])}" opacity="${0.12 + r() * 0.4}"/>`;
  });
  return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="${w * 0.006}"/></filter>${vignette}</defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/><g filter="url(#blur)">${bokeh.join("")}</g>`;
}

function nature(r: Rand, w: number, h: number, p: string[]) {
  const stems = Array.from({ length: 90 }, () => {
    const x = r() * w;
    const top = h * (0.25 + r() * 0.6);
    const bend = (r() - 0.5) * w * 0.12;
    return `<path d="M${x} ${h} Q${x + bend / 2} ${(h + top) / 2} ${x + bend} ${top}" stroke="${pick(r, [p[1], p[2], p[0]])}" stroke-width="${w * (0.002 + r() * 0.004)}" fill="none" opacity="${0.5 + r() * 0.5}"/>`;
  });
  return `<defs><radialGradient id="bg" cx="0.6" cy="0.35" r="0.8"><stop offset="0" stop-color="${p[4]}"/><stop offset="0.6" stop-color="${p[3]}"/><stop offset="1" stop-color="${p[1]}"/></radialGradient>${vignette}</defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>${stems.join("")}`;
}

export const SCENES = { landscape, sea, portrait, architecture, city, nature };
export type SceneName = keyof typeof SCENES;

export async function renderSample(scene: SceneName, palette: PaletteName, w: number, h: number, seed: number) {
  const r = rng(seed);
  const p = PALETTES[palette];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${SCENES[scene](r, w, h, p)}
    <rect width="${w}" height="${h}" fill="url(#vig)"/>
  </svg>`;
  return sharp(Buffer.from(svg), { limitInputPixels: false })
    .composite([{ input: await grain(), tile: true, blend: "overlay" }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
