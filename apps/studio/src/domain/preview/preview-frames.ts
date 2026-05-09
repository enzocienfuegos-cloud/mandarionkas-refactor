export type PreviewFrameId =
  | 'none'
  | 'iphone14'
  | 'pixel8'
  | 'article';
export type PreviewFrameType = 'plain' | 'mobile' | 'web';
export type PreviewFrameShell = 'none' | 'device' | 'article';

export type PreviewFramePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreviewFrame = {
  id: PreviewFrameId;
  label: string;
  type: PreviewFrameType;
  shell: PreviewFrameShell;
  chromeWidth: number;
  chromeHeight: number;
  safeAreaTop?: number;
  safeAreaBottom?: number;
  placement: PreviewFramePlacement;
  articleTemplate?: 'news';
  chromeTitle?: string;
  chromeSubtitle?: string;
  chromeUrl?: string;
  chromeBadge?: string;
};

export const PREVIEW_FRAMES: PreviewFrame[] = [
  {
    id: 'none',
    label: 'No frame',
    type: 'plain',
    shell: 'none',
    chromeWidth: 0,
    chromeHeight: 0,
    placement: { x: 0, y: 0, width: 0, height: 0 },
  },
  {
    id: 'iphone14',
    label: 'iPhone 14',
    type: 'mobile',
    shell: 'device',
    chromeWidth: 390,
    chromeHeight: 844,
    safeAreaTop: 47,
    safeAreaBottom: 34,
    placement: { x: 24, y: 126, width: 342, height: 520 },
    chromeTitle: 'Preview',
    chromeSubtitle: 'Native app shell',
  },
  {
    id: 'pixel8',
    label: 'Pixel 8',
    type: 'mobile',
    shell: 'device',
    chromeWidth: 412,
    chromeHeight: 915,
    safeAreaTop: 36,
    safeAreaBottom: 24,
    placement: { x: 22, y: 124, width: 368, height: 586 },
    chromeTitle: 'Preview',
    chromeSubtitle: 'Android device shell',
  },
  {
    id: 'article',
    label: 'Article page',
    type: 'web',
    shell: 'article',
    chromeWidth: 1024,
    chromeHeight: 768,
    placement: { x: 172, y: 246, width: 680, height: 312 },
    articleTemplate: 'news',
    chromeUrl: 'newsroom.example/story/campaign-launch',
    chromeBadge: 'Sponsored feature',
  },
];

const PREVIEW_FRAME_MAP = Object.fromEntries(PREVIEW_FRAMES.map((frame) => [frame.id, frame])) as Record<PreviewFrameId, PreviewFrame>;

export function getPreviewFrame(frameId: PreviewFrameId | undefined): PreviewFrame {
  return frameId ? PREVIEW_FRAME_MAP[frameId] ?? PREVIEW_FRAME_MAP.none : PREVIEW_FRAME_MAP.none;
}
