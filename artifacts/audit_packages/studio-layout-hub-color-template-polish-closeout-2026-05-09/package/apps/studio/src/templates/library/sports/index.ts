import { createSimpleTemplate } from '../helpers/simple-template-builder';
export { WORLD_CUP_TEMPLATE } from '../world-cup';

export const SPORTS_MATCHDAY_COUNTDOWN_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'sports-matchday-countdown',
    name: 'Matchday Countdown',
    description: 'Sports countdown layout for matchday hype, pre-game reminders and ticket sales.',
    vertical: 'sports',
    canvasPresetId: 'interstitial',
    featuredLabel: 'Fast launch',
    curationRank: 84,
    sceneCount: 1,
    moduleHighlights: ['Countdown framing', 'High-attention CTA'],
    recommendedFor: 'Ticket pushes, sponsor countdowns and matchday reminders',
  },
  palette: {
    background: '#07111f',
    surface: '#0d1c31',
    accent: '#ffd166',
    text: '#ffffff',
    muted: '#b7c3d8',
  },
  badge: 'KICKOFF',
  eyebrow: 'Matchday energy',
  headline: 'Build anticipation before the whistle.',
  subhead: 'A fast-moving sports layout for countdowns, rivalry messaging and high-attention CTA moments.',
  supporting: 'Works for ticketing, sponsors and short-run event pushes.',
  cta: 'Get tickets',
  imageLabel: 'Matchday',
});

export const SPORTS_FAN_REWARD_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'sports-fan-reward',
    name: 'Fan Reward Unlock',
    description: 'Reward-driven sports creative for loyalty pushes, second-screen promos and fan activations.',
    vertical: 'sports',
    canvasPresetId: 'medium-rectangle',
    curationRank: 72,
    sceneCount: 1,
    moduleHighlights: ['Reward loop', 'Second-screen promo'],
    recommendedFor: 'Loyalty activations and fan reward drops',
  },
  palette: {
    background: '#101827',
    surface: '#15253b',
    accent: '#2ce6ff',
    text: '#ffffff',
    muted: '#b8c9d8',
  },
  badge: 'FAN PASS',
  eyebrow: 'Activation loop',
  headline: 'Reward the fan action, not just the final score.',
  subhead: 'Great for promo unlocks, code reveals and quick sweepstakes loops around live events.',
  supporting: 'Supports loyalty hooks, timed drops and sponsor-driven moments.',
  cta: 'Unlock reward',
  imageLabel: 'Fan Reward',
});
