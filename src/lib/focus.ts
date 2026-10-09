/*
 * Detección automática del PUNTO DE ENFOQUE de una foto: la parte que tiene
 * que quedar a la vista cuando la foto se recorta (por ejemplo, en la portada
 * una foto vertical en una pantalla ancha sólo muestra una franja).
 *
 * No hay inteligencia artificial: es un cálculo sobre los píxeles de una
 * versión chica de la foto (~200px), que funciona igual en el navegador (al
 * subir la foto, lib/client-image.ts, y en el panel de Contenido) y que no
 * depende de que haya caras. Para cada píxel se mide cuánto "llama la atención":
 *
 *   - Contraste con el resto: qué tan distinto es su color del color promedio
 *     de la foto (un método clásico de "saliencia"). Una flor blanca sobre un
 *     fondo oscuro, el sol en un paisaje, una persona en una pared lisa.
 *   - Nitidez: los bordes marcados (lo que está en foco) cuentan más que las
 *     zonas lisas o desenfocadas del fondo.
 *   - Piel: los tonos de piel suman, porque si hay una persona casi siempre
 *     es lo importante.
 *   - Color: los colores vivos suman un poco.
 *
 * Después se prueba dónde ubicar una "ventana" con la forma de la pantalla
 * (ancha para la computadora, angosta para el celular) y se elige la posición
 * que junta más puntaje. Esa posición es el punto de enfoque, expresado como
 * porcentaje (lo que entiende CSS en object-position).
 */

export interface Focus {
  /** 0 = borde izquierdo, 100 = borde derecho */
  x: number;
  /** 0 = borde de arriba, 100 = borde de abajo */
  y: number;
}

export const CENTER: Focus = { x: 50, y: 50 };

/** Lado largo de la imagen sobre la que se calcula (más grande no mejora y tarda más). */
export const FOCUS_SAMPLE = 200;

// Pesos de cada señal (se suman después de normalizar cada una entre 0 y 1)
const W_CONTRAST = 1;
const W_DETAIL = 0.7;
const W_SKIN = 1.1;
const W_SATURATION = 0.3;

// Formas de pantalla con las que se prueba la ventana (ancho / alto)
const WIDE_SCREEN = 16 / 9;
const NARROW_SCREEN = 9 / 19.5;

/** Convierte "x% y%" (o null) en un punto; si no se entiende, el centro. */
export function parseFocus(value: string | null | undefined): Focus {
  const m = /^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/.exec((value ?? "").trim());
  if (!m) return CENTER;
  return { x: clampPercent(Number(m[1])), y: clampPercent(Number(m[2])) };
}

export const focusToCss = (f: Focus) => `${Math.round(f.x)}% ${Math.round(f.y)}%`;

export const clampPercent = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50);

/** Punto de enfoque guardado en la foto (focusX/focusY en la base), o el centro si todavía no tiene. */
export function photoFocus(p: { focusX: number | null; focusY: number | null }): Focus {
  return p.focusX == null || p.focusY == null ? CENTER : { x: p.focusX, y: p.focusY };
}

/**
 * Calcula el punto de enfoque a partir de los píxeles RGBA de una versión
 * chica de la foto (4 valores por píxel, como devuelve canvas.getImageData).
 */
export function detectFocus(rgba: ArrayLike<number>, width: number, height: number): Focus {
  const n = width * height;
  if (n < 16) return CENTER;

  // 1) Color de cada píxel en Lab (una escala de color parecida a como lo ve el ojo)
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  const skin = new Float32Array(n);
  const sat = new Float32Array(n);
  let mL = 0, mA = 0, mB = 0;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255;
    const [l, a, bb] = toLab(r, g, b);
    L[i] = l; A[i] = a; B[i] = bb;
    mL += l; mA += a; mB += bb;
    skin[i] = skinScore(r, g, b, l);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // Saturación, ignorando lo casi negro (ruido) y lo casi blanco
    sat[i] = max > 0.12 && min < 0.95 ? (max - min) / max : 0;
  }
  mL /= n; mA /= n; mB /= n;

  // 2) Contraste con el promedio (sobre la foto apenas suavizada) y nitidez (bordes)
  const sL = boxBlur(L, width, height, 1);
  const sA = boxBlur(A, width, height, 1);
  const sB = boxBlur(B, width, height, 1);
  const contrast = new Float32Array(n);
  const detail = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      contrast[i] = Math.hypot(sL[i] - mL, sA[i] - mA, sB[i] - mB);
      if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        detail[i] = Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - width] - L[i + width]);
      }
    }
  }
  // La nitidez se reparte un poco para que cuente la zona y no sólo el borde
  const detailArea = boxBlur(detail, width, height, 2);

  normalize(contrast);
  normalize(detailArea);
  normalize(sat);
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    score[i] = W_CONTRAST * contrast[i] + W_DETAIL * detailArea[i] + W_SKIN * skin[i] + W_SATURATION * sat[i];
  }

  // 3) Puntaje por fila y por columna, para mover la ventana rápido
  const rows = new Float32Array(height);
  const cols = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = score[y * width + x];
      rows[y] += s;
      cols[x] += s;
    }
  }

  // Ventana de pantalla ancha: decide la altura (y). Ventana angosta: decide el costado (x).
  const winH = Math.min(height, Math.round(width / WIDE_SCREEN));
  const winW = Math.min(width, Math.round(height * NARROW_SCREEN));
  return { x: bestOffset(cols, winW), y: bestOffset(rows, winH) };
}

/**
 * Dónde ubicar una ventana de `size` a lo largo de `line` para juntar más
 * puntaje. Lo que queda en el medio de la ventana pesa más que lo que queda
 * pegado al borde, y ante empates gana el centro de la foto.
 * Devuelve el porcentaje para object-position.
 */
function bestOffset(line: Float32Array, size: number): number {
  const total = line.length;
  const room = total - size;
  if (room <= 1) return 50;
  let best = 0, bestScore = -Infinity;
  for (let start = 0; start <= room; start++) {
    let s = 0;
    for (let k = 0; k < size; k++) s += line[start + k] * (0.55 + 0.45 * Math.sin((Math.PI * (k + 0.5)) / size));
    s *= 1 - 0.08 * Math.abs(start / room - 0.5) * 2;
    if (s > bestScore) { bestScore = s; best = start; }
  }
  return clampPercent((best / room) * 100);
}

/** sRGB (0..1) → CIE Lab */
function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), Bl = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * Bl) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * Bl;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * Bl) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** 0..1: qué tan parecido es el color a un tono de piel (con luz suficiente). */
function skinScore(r: number, g: number, b: number, lab: number): number {
  if (lab < 25 || lab > 95 || r <= g || g < b * 0.9) return 0;
  const mag = Math.hypot(r, g, b) || 1;
  // Dirección de color típica de la piel (independiente de cuán clara u oscura sea)
  const d = Math.hypot(r / mag - 0.78, g / mag - 0.53, b / mag - 0.33);
  return Math.max(0, 1 - d / 0.18);
}

/** Promedio de cada píxel con sus vecinos en un radio `r` (suaviza). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { s += src[y * w + k]; c++; }
      tmp[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { s += tmp[k * w + x]; c++; }
      out[y * w + x] = s / c;
    }
  }
  return out;
}

/** Lleva los valores a 0..1, usando un valor alto (no el máximo) para que un píxel suelto no aplaste al resto. */
function normalize(values: Float32Array) {
  const sorted = Float32Array.from(values).sort();
  const top = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1] || 1;
  for (let i = 0; i < values.length; i++) values[i] = Math.min(1, values[i] / top);
}
