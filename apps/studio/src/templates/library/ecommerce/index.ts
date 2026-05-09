import { createSimpleTemplate } from '../helpers/simple-template-builder';

export const ECOMMERCE_FLASH_DROP_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'ecommerce-flash-drop',
    name: 'Flash Drop Launch',
    description: 'High-contrast ecommerce launch with strong CTA focus and product-first framing.',
    vertical: 'ecommerce',
    canvasPresetId: 'leaderboard',
  },
  palette: {
    background: '#fff5ef',
    surface: '#ffffff',
    accent: '#ff6a00',
    text: '#141414',
    muted: '#6b635d',
  },
  badge: 'DROP 01',
  eyebrow: 'Ecommerce launch',
  headline: 'Launch the drop before inventory disappears.',
  subhead: 'Hero-led launch system for flash collections, creator collaborations and scarcity moments.',
  supporting: 'Built to carry product image, promo framing and a strong buy-now motion.',
  cta: 'Shop the drop',
  imageLabel: 'Flash Drop',
});

export const ECOMMERCE_CART_RESCUE_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'ecommerce-cart-rescue',
    name: 'Cart Rescue Offer',
    description: 'Recovery template for discount reminders, urgency nudges and abandoned-cart retargeting.',
    vertical: 'ecommerce',
    canvasPresetId: 'medium-rectangle',
  },
  palette: {
    background: '#eef7ff',
    surface: '#fefefe',
    accent: '#145cff',
    text: '#0f172a',
    muted: '#4f5d75',
  },
  badge: 'SAVE 15%',
  eyebrow: 'Recovery flow',
  headline: 'Bring back high-intent shoppers with one strong offer.',
  subhead: 'Lean layout for discount cadence, product reminders and quick landing-page handoff.',
  supporting: 'Works well for dynamic pricing, urgency copy and last-touch retargeting.',
  cta: 'Recover cart',
  imageLabel: 'Cart Rescue',
});
