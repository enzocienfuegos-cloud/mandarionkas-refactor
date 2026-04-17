export type CanvasPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'instagram_story', label: 'Instagram Story 1080x1920', width: 1080, height: 1920 },
  { id: 'instagram_square', label: 'Instagram Square 1080x1080', width: 1080, height: 1080 },
  { id: 'facebook_landscape', label: 'Facebook Landscape 1200x628', width: 1200, height: 628 },
  { id: 'tiktok_vertical', label: 'TikTok Vertical 1080x1920', width: 1080, height: 1920 },
  { id: 'display_banner', label: 'Display Banner 300x250', width: 300, height: 250 },
  { id: 'custom', label: 'Custom size', width: 1280, height: 720 },
];

export function getCanvasPresetById(id?: string): CanvasPreset | undefined {
  const resolvedId = String(id || '').trim() || 'custom';
  return CANVAS_PRESETS.find((preset) => preset.id === resolvedId);
}
