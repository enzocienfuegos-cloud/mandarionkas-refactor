export type CanvasPreset = {
  id: string;
  label: string;
  category: 'display' | 'story' | 'custom';
  width: number;
  height: number;
  backgroundColor?: string;
};

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'leaderboard', label: 'Leaderboard · 970×250', category: 'display', width: 970, height: 250, backgroundColor: '#ffffff' },
  { id: 'medium-rectangle', label: 'MREC · 300×250', category: 'display', width: 300, height: 250, backgroundColor: '#ffffff' },
  { id: 'wide-skyscraper', label: 'Skyscraper · 300×600', category: 'display', width: 300, height: 600, backgroundColor: '#ffffff' },
  { id: 'interstitial', label: 'Interstitial · 320×480', category: 'display', width: 320, height: 480, backgroundColor: '#ffffff' },
  { id: 'story-vertical', label: 'Story · 1080×1920', category: 'story', width: 1080, height: 1920, backgroundColor: '#ffffff' },
  { id: 'square-social', label: 'Square · 1080×1080', category: 'story', width: 1080, height: 1080, backgroundColor: '#ffffff' },
  { id: 'custom', label: 'Custom', category: 'custom', width: 970, height: 250, backgroundColor: '#ffffff' },
];

const LEGACY_CANVAS_PRESET_ALIASES: Record<string, string> = {
  '300x250': 'medium-rectangle',
  '300x600': 'wide-skyscraper',
  '320x480': 'interstitial',
  '970x250': 'leaderboard',
  '1080x1920': 'story-vertical',
  '1080x1080': 'square-social',
};

export function getCanvasPresetById(id?: string): CanvasPreset | undefined {
  const resolvedId = id ? (LEGACY_CANVAS_PRESET_ALIASES[id] ?? id) : id;
  return CANVAS_PRESETS.find((preset) => preset.id === resolvedId);
}
