import type { ScratchCoverDescriptor } from './types';

const MAX_DPR = 2;

export function configureCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): number {
  const dpr = typeof window === 'undefined'
    ? 1
    : Math.max(1, Math.min(MAX_DPR, Number(window.devicePixelRatio || 1)));
  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== pxW) canvas.width = pxW;
  if (canvas.height !== pxH) canvas.height = pxH;
  return dpr;
}

export function getCtx(canvas: HTMLCanvasElement, willReadFrequently = false): CanvasRenderingContext2D | null {
  return willReadFrequently
    ? canvas.getContext('2d', { alpha: true, desynchronized: true, willReadFrequently: true })
    : canvas.getContext('2d', { alpha: true, desynchronized: true });
}

export async function paintCover(
  canvas: HTMLCanvasElement,
  cover: ScratchCoverDescriptor,
  cssW: number,
  cssH: number,
): Promise<void> {
  const dpr = configureCanvas(canvas, cssW, cssH);
  const ctx = getCtx(canvas);
  if (!ctx) return;
  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.globalCompositeOperation = 'source-over';

  if (cover.kind === 'color') {
    ctx.fillStyle = cover.value;
    ctx.fillRect(0, 0, cssW, cssH);
    return;
  }

  if (cover.kind === 'image') {
    const img = await loadImage(cover.src);
    drawImageFit(ctx, img, cssW, cssH, cover.fit ?? 'cover');
    return;
  }

  const dataUrl = await rasterizeHtml(cover.el, cssW, cssH);
  const img = await loadImage(dataUrl);
  ctx.drawImage(img, 0, 0, cssW, cssH);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = reject;
      fallback.src = src;
    };
    img.src = src;
  });
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cssW: number,
  cssH: number,
  fit: 'cover' | 'contain' | 'fill',
): void {
  const sw = img.naturalWidth || cssW;
  const sh = img.naturalHeight || cssH;
  if (fit === 'fill') {
    ctx.drawImage(img, 0, 0, cssW, cssH);
    return;
  }
  const scale = fit === 'contain'
    ? Math.min(cssW / Math.max(1, sw), cssH / Math.max(1, sh))
    : Math.max(cssW / Math.max(1, sw), cssH / Math.max(1, sh));
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
}

async function rasterizeHtml(el: HTMLElement, cssW: number, cssH: number): Promise<string> {
  const clone = el.cloneNode(true) as HTMLElement;
  inlineComputedStyles(el, clone);
  const xhtml = new XMLSerializer().serializeToString(clone);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cssW}" height="${cssH}">`,
    '<foreignObject width="100%" height="100%">',
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${cssW}px;height:${cssH}px">`,
    xhtml,
    '</div>',
    '</foreignObject>',
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function inlineComputedStyles(src: Element, dst: Element): void {
  const srcStyle = window.getComputedStyle(src);
  const cssText: string[] = [];
  for (let index = 0; index < srcStyle.length; index += 1) {
    const prop = srcStyle.item(index);
    cssText.push(`${prop}:${srcStyle.getPropertyValue(prop)}`);
  }
  (dst as HTMLElement).setAttribute('style', cssText.join(';'));
  const srcChildren = Array.from(src.children);
  const dstChildren = Array.from(dst.children);
  for (let index = 0; index < srcChildren.length && index < dstChildren.length; index += 1) {
    inlineComputedStyles(srcChildren[index], dstChildren[index]);
  }
}
