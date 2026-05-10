import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type Placement,
} from '@floating-ui/react';

export function createFloatingPositioner(
  reference: HTMLElement,
  floating: HTMLElement,
  options: { placement?: Placement; offset?: number } = {},
) {
  const update = async () => {
    const { x, y } = await computePosition(reference, floating, {
      placement: options.placement ?? 'top',
      middleware: [
        offset(options.offset ?? 8),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
      ],
    });

    Object.assign(floating.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  };

  return autoUpdate(reference, floating, update);
}
