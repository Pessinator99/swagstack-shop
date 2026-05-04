import type { NormRect } from "@/lib/colormatch/pixel-coordinates";

const CANVAS_SIZE = 800;

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = src;
  });
}

/**
 * Rendert Produkt + Logo (normiertes overlayRect, bereits mit scaledLogoOverlayRect)
 * auf 800×800 PNG-Data-URL — gleiche Geometrie wie PDP/ColorMatch-Overlay.
 */
export async function createMarketingMockupCanvas(opts: {
  productImageUrl: string;
  logoDataUrl: string | null;
  overlayRect: NormRect;
}): Promise<string> {
  const W = CANVAS_SIZE;
  const H = CANVAS_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");

  const productImg = await loadImage(opts.productImageUrl, true);
  const scale = Math.min(W / productImg.naturalWidth, H / productImg.naturalHeight);
  const dw = productImg.naturalWidth * scale;
  const dh = productImg.naturalHeight * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;

  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(productImg, dx, dy, dw, dh);

  if (opts.logoDataUrl) {
    const logo = await loadImage(opts.logoDataUrl, false);
    const r = opts.overlayRect;
    const lx = r.x * W;
    const ly = r.y * H;
    const lw = r.width * W;
    const lh = r.height * H;
    ctx.drawImage(logo, lx, ly, lw, lh);
  }

  return canvas.toDataURL("image/png");
}
