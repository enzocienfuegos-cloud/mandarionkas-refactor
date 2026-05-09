import { createSimpleTemplate } from '../helpers/simple-template-builder';

export const FINANCE_CREDIT_BOOST_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'finance-credit-boost',
    name: 'Credit Boost Offer',
    description: 'Finance template for card acquisition, rate messaging and trust-forward conversion.',
    vertical: 'finance',
    canvasPresetId: 'leaderboard',
  },
  palette: {
    background: '#eef4ff',
    surface: '#ffffff',
    accent: '#3558ff',
    text: '#111827',
    muted: '#5b6580',
  },
  badge: 'APR UPDATE',
  eyebrow: 'Financial acquisition',
  headline: 'Promote higher-value card offers without losing clarity.',
  subhead: 'Designed for trust, speed and stronger rate presentation across acquisition funnels.',
  supporting: 'Fits rate updates, sign-up rewards and credit-building product lines.',
  cta: 'See eligibility',
  imageLabel: 'Credit Boost',
});

export const FINANCE_WEALTH_CHECKIN_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'finance-wealth-checkin',
    name: 'Wealth Check-In',
    description: 'Premium finance layout for advisory campaigns, wealth snapshots and market recaps.',
    vertical: 'finance',
    canvasPresetId: 'leaderboard',
  },
  palette: {
    background: '#f3f7fb',
    surface: '#ffffff',
    accent: '#0f766e',
    text: '#0f172a',
    muted: '#506173',
  },
  badge: 'Q2 OUTLOOK',
  eyebrow: 'Advisory update',
  headline: 'Turn market updates into calm, premium client communication.',
  subhead: 'Built for executive tone, advisory highlights and trust-led creative refreshes.',
  supporting: 'Useful for portfolio updates, wealth reports and retention messaging.',
  cta: 'View outlook',
  imageLabel: 'Wealth Outlook',
});
