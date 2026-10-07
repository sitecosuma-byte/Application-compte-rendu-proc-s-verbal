/**
 * Chargement du logo COSUMA-RDC pour l'en-tête Word.
 *
 * Ordre de recherche :
 *   1. Logo importé dans « Paramètres » (stocké localement, data URL)
 *   2. public/logo-cosuma.png  (logo officiel à déposer par l'utilisateur)
 *   3. public/logo-cosuma.svg  (logo provisoire fourni avec le projet)
 *
 * Quel que soit le format source (PNG, JPEG, SVG, WebP), l'image est convertie en PNG
 * via un <canvas> : Word l'affiche alors de façon fiable sur toutes les versions.
 */

export interface LogoImage {
  data: Uint8Array;
  width: number; // pixels de l'image rendue
  height: number;
}

const LOGO_CANDIDATES = ["/logo-cosuma.png", "/logo-cosuma.jpg", "/logo-cosuma.svg"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${src.slice(0, 60)}`));
    img.src = src;
  });
}

async function rasterize(src: string, maxSide = 600): Promise<LogoImage> {
  const img = await loadImage(src);
  const w0 = img.naturalWidth || 512;
  const h0 = img.naturalHeight || 512;
  const scale = Math.min(1, maxSide / Math.max(w0, h0)) || 1;
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Conversion PNG impossible");
  return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadLogo(customDataUrl: string | null): Promise<LogoImage | null> {
  if (customDataUrl) {
    try {
      return await rasterize(customDataUrl);
    } catch {
      /* on tente les fichiers du dossier public */
    }
  }
  for (const url of LOGO_CANDIDATES) {
    if (await exists(url)) {
      try {
        return await rasterize(url);
      } catch {
        /* candidat suivant */
      }
    }
  }
  return null;
}

/** Calcule une taille d'affichage (en pixels Word) qui tient dans une boîte donnée. */
export function fitBox(logo: LogoImage, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / logo.width, maxH / logo.height);
  return { width: Math.round(logo.width * ratio), height: Math.round(logo.height * ratio) };
}
