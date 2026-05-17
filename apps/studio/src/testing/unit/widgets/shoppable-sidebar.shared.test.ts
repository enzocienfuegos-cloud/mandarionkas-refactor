import { describe, expect, it } from 'vitest';
import { buildShoppableProductsValue, parseShoppableProducts } from '../../../widgets/modules/shoppable-sidebar.shared';

describe('shoppable sidebar shared helpers', () => {
  it('round-trips products with asset ids', () => {
    const value = buildShoppableProductsValue([
      {
        src: 'https://cdn.example.com/product.jpg',
        assetId: 'asset-1',
        title: 'Product 1',
        subtitle: 'Featured',
        price: '$19',
        rating: 5,
        ctaLabel: 'Shop now',
        url: 'https://example.com/product-1',
      },
    ]);

    expect(parseShoppableProducts(value)).toEqual([
      {
        src: 'https://cdn.example.com/product.jpg',
        assetId: 'asset-1',
        title: 'Product 1',
        subtitle: 'Featured',
        price: '$19',
        rating: 5,
        ctaLabel: 'Shop now',
        url: 'https://example.com/product-1',
      },
    ]);
  });

  it('keeps parsing legacy product strings without asset ids', () => {
    expect(parseShoppableProducts('https://cdn.example.com/product.jpg|Product 1|Featured|$19|5|Shop now|https://example.com/product-1')).toEqual([
      {
        src: 'https://cdn.example.com/product.jpg',
        assetId: undefined,
        title: 'Product 1',
        subtitle: 'Featured',
        price: '$19',
        rating: 5,
        ctaLabel: 'Shop now',
        url: 'https://example.com/product-1',
      },
    ]);
  });
});
