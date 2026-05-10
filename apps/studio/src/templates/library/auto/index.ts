import { createSimpleTemplate } from '../helpers/simple-template-builder';

export const AUTO_EV_REVEAL_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'auto-ev-reveal',
    name: 'EV Reveal',
    description: 'Automotive reveal template for flagship launches, test-drive pushes and premium feature framing.',
    vertical: 'auto',
    canvasPresetId: 'leaderboard',
  },
  palette: {
    background: '#f3f8fb',
    surface: '#ffffff',
    accent: '#0ea5e9',
    text: '#0f172a',
    muted: '#54657a',
  },
  badge: 'NEW MODEL',
  eyebrow: 'Automotive launch',
  headline: 'Show the new vehicle like a premiere, not a price card.',
  subhead: 'High-surface editorial template for EV reveals, hero features and premium positioning.',
  supporting: 'Best for launch waves, configurator handoff and short-form awareness.',
  cta: 'Book a test drive',
  imageLabel: 'EV Reveal',
});

export const AUTO_SERVICE_PUSH_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'auto-service-push',
    name: 'Service Push',
    description: 'Maintenance and after-sales template for service reminders, seasonal checks and dealer promos.',
    vertical: 'auto',
    canvasPresetId: 'medium-rectangle',
  },
  palette: {
    background: '#fff7f1',
    surface: '#ffffff',
    accent: '#ea580c',
    text: '#1f2937',
    muted: '#6b7280',
  },
  badge: 'SERVICE',
  eyebrow: 'Dealer operations',
  headline: 'Bring service reminders into the same premium system as launch creative.',
  subhead: 'Clear message hierarchy for maintenance windows, parts offers and booking CTAs.',
  supporting: 'Useful for seasonal checkups, after-sales CRM and retention campaigns.',
  cta: 'Schedule service',
  imageLabel: 'Service Push',
});
