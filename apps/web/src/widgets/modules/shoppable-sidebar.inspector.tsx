import { useMemo } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { buildShoppableProductsValue, parseShoppableProducts, type ShoppableProduct } from './shoppable-sidebar.shared';

export function ShoppableSidebarInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const uiActions = useUiActions();

  const products = useMemo(() => parseShoppableProducts(widget.props.products), [widget.props.products]);
  const ctaBackgroundColor = String((widget.style as Record<string, unknown>).ctaBackgroundColor ?? widget.style.accentColor ?? '#9a3412');
  const ctaTextColor = String((widget.style as Record<string, unknown>).ctaTextColor ?? '#111827');

  const updateProducts = (nextProducts: ShoppableProduct[]) => {
    widgetActions.updateWidgetProps(widget.id, {
      products: buildShoppableProductsValue(nextProducts),
      itemCount: Math.max(1, nextProducts.length),
      activeIndex: Math.min(Math.max(1, Number(widget.props.activeIndex ?? 1)), Math.max(1, nextProducts.length)),
    });
  };

  const removeProduct = (index: number) => {
    const nextProducts = products.filter((_, itemIndex) => itemIndex !== index);
    updateProducts(nextProducts);
  };

  const patchProduct = (index: number, patch: Partial<ShoppableProduct>) => {
    const nextProducts = products.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    updateProducts(nextProducts);
  };

  const addBlankProduct = () => {
    updateProducts([
      ...products,
      {
        src: '',
        title: `Product ${products.length + 1}`,
        subtitle: '',
        price: '$0',
        rating: 4,
        ctaLabel: 'Shop now',
        url: '',
      },
    ]);
  };

  return (
    <section className="section section-premium">
      <h3>Shoppable sidebar</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { title: event.target.value })} />
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div>
            <label>Layout</label>
            <select value={String(widget.props.orientation ?? 'horizontal')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { orientation: event.target.value })}>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </div>
          <div>
            <label>Card shape</label>
            <select value={String(widget.props.cardShape ?? 'portrait')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { cardShape: event.target.value })}>
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
              <option value="square">Square</option>
            </select>
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(widget.props.autoscroll ?? true)}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { autoscroll: event.target.checked })}
          />
          Autoscroll
        </label>
        <div>
          <label>Interval ms</label>
          <input type="number" step="1" value={String(widget.props.intervalMs ?? 2600)} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { intervalMs: Number(event.target.value) })} />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(widget.props.showPrevButton ?? true)}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showPrevButton: event.target.checked })}
          />
          Show left arrow
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(widget.props.showNextButton ?? true)}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showNextButton: event.target.checked })}
          />
          Show right arrow
        </label>
        <div>
          <label>Product source</label>
          <div className="field-stack">
            <small className="muted">Add product images from the asset library. This module no longer shows a preloaded image list here.</small>
            <div className="rail-action-grid">
              <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Open library</button>
              <button type="button" className="left-button compact-action" onClick={addBlankProduct}>Add blank product</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div>
            <label>CTA background</label>
            <input type="color" value={ctaBackgroundColor} onChange={(event) => widgetActions.updateWidgetStyle(widget.id, { ctaBackgroundColor: event.target.value })} />
          </div>
          <div>
            <label>CTA text</label>
            <input type="color" value={ctaTextColor} onChange={(event) => widgetActions.updateWidgetStyle(widget.id, { ctaTextColor: event.target.value })} />
          </div>
        </div>
        <div>
          <label>Products</label>
          <div className="field-stack">
            {!products.length ? <small className="muted">No products selected yet.</small> : null}
            {products.map((product, index) => (
              <div key={`${widget.id}-product-${index}`} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 10, display: 'grid', gap: 8 }}>
                <div className="meta-line" style={{ justifyContent: 'space-between' }}>
                  <strong>{`Product ${index + 1}`}</strong>
                  <button type="button" className="chip" onClick={() => removeProduct(index)}>Remove</button>
                </div>
                <input value={product.title} placeholder="Product title" onChange={(event) => patchProduct(index, { title: event.target.value })} />
                <input value={product.subtitle} placeholder="Subtitle" onChange={(event) => patchProduct(index, { subtitle: event.target.value })} />
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <input value={product.price} placeholder="$250" onChange={(event) => patchProduct(index, { price: event.target.value })} />
                  <input type="number" min="0" max="5" step="1" value={String(product.rating)} placeholder="Stars" onChange={(event) => patchProduct(index, { rating: Number(event.target.value) })} />
                </div>
                <input value={product.ctaLabel} placeholder="CTA label" onChange={(event) => patchProduct(index, { ctaLabel: event.target.value })} />
                <input value={product.url} placeholder="https://example.com/product" onChange={(event) => patchProduct(index, { url: event.target.value })} />
                <small className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.src}</small>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label>Advanced product data</label>
          <textarea rows={5} value={String(widget.props.products ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { products: event.target.value, itemCount: parseShoppableProducts(event.target.value).length || Number(widget.props.itemCount ?? 1) })} />
        </div>
      </div>
    </section>
  );
}
