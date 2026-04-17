import type { WidgetFrame, WidgetNode } from './types';

export type WidgetActionTargetOption = {
  value: string;
  label: string;
};

export type WidgetActionTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getWidgetActionTargetOptions(widget: WidgetNode): WidgetActionTargetOption[] {
  switch (widget.type) {
    case 'buttons':
      return [
        { value: 'primary-button', label: 'Primary button' },
        { value: 'secondary-button', label: 'Secondary button' },
      ];
    case 'interactive-hotspot':
      return [
        { value: 'hotspot-pin', label: 'Hotspot pin' },
        { value: 'hotspot-card', label: 'Hotspot card' },
      ];
    case 'image-carousel':
      return [
        { value: 'carousel-root', label: 'Carousel root' },
        { value: 'carousel-prev', label: 'Previous control' },
        { value: 'carousel-next', label: 'Next control' },
      ];
    default:
      return [];
  }
}

export function getWidgetActionTargetRect(widget: WidgetNode, targetKey: string, frame: WidgetFrame = widget.frame): WidgetActionTargetRect {
  if (widget.type === 'buttons') {
    const vertical = String(widget.props.orientation ?? 'horizontal') === 'vertical';
    if (targetKey === 'primary-button') {
      return vertical
        ? { x: frame.x, y: frame.y, width: frame.width, height: frame.height / 2 }
        : { x: frame.x, y: frame.y, width: frame.width / 2, height: frame.height };
    }
    if (targetKey === 'secondary-button') {
      return vertical
        ? { x: frame.x, y: frame.y + frame.height / 2, width: frame.width, height: frame.height / 2 }
        : { x: frame.x + frame.width / 2, y: frame.y, width: frame.width / 2, height: frame.height };
    }
  }

  if (widget.type === 'interactive-hotspot') {
    const hotspotX = Number(widget.props.hotspotX ?? 55);
    const hotspotY = Number(widget.props.hotspotY ?? 45);
    const pinSize = 32;
    if (targetKey === 'hotspot-pin') {
      return {
        x: frame.x + (frame.width * hotspotX) / 100 - pinSize / 2,
        y: frame.y + (frame.height * hotspotY) / 100 - pinSize / 2,
        width: pinSize,
        height: pinSize,
      };
    }
    if (targetKey === 'hotspot-card') {
      return {
        x: frame.x + 12,
        y: frame.y + Math.max(0, frame.height - 64),
        width: Math.max(80, frame.width - 24),
        height: 52,
      };
    }
  }

  if (widget.type === 'image-carousel') {
    if (targetKey === 'carousel-prev') {
      return {
        x: frame.x,
        y: frame.y + Math.max(0, frame.height - 44),
        width: frame.width / 2,
        height: 44,
      };
    }
    if (targetKey === 'carousel-next') {
      return {
        x: frame.x + frame.width / 2,
        y: frame.y + Math.max(0, frame.height - 44),
        width: frame.width / 2,
        height: 44,
      };
    }
  }

  return {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  };
}
