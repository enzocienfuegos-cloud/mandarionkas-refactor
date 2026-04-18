export type ShoppableProduct = {
  src: string;
  title: string;
  subtitle: string;
  price: string;
  rating: number;
  ctaLabel: string;
  url: string;
};

export function parseShoppableProducts(raw: unknown): ShoppableProduct[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [src, title, subtitle, price, rating, ctaLabel, url] = item.split('|');
      return {
        src: (src ?? '').trim(),
        title: (title ?? `Product ${index + 1}`).trim(),
        subtitle: (subtitle ?? '').trim(),
        price: (price ?? '').trim(),
        rating: Math.max(0, Math.min(5, Number(rating ?? 4) || 4)),
        ctaLabel: (ctaLabel ?? 'Shop now').trim(),
        url: (url ?? '').trim(),
      };
    })
    .filter((item) => item.src.length > 0 || item.title.length > 0);
}

export function buildShoppableProductsValue(items: ShoppableProduct[]): string {
  return items
    .filter((item) => item.src.trim().length > 0 || item.title.trim().length > 0)
    .map((item) => [
      item.src.trim(),
      item.title.trim(),
      item.subtitle.trim(),
      item.price.trim(),
      String(Math.max(0, Math.min(5, Number(item.rating) || 0))),
      item.ctaLabel.trim(),
      item.url.trim(),
    ].join('|'))
    .join(';');
}

export function renderRatingStars(rating: number): string {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(clamped)}${'☆'.repeat(Math.max(0, 5 - clamped))}`;
}
