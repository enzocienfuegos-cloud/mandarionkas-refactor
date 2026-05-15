import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasSizePicker } from '../../../app/shell/topbar/CanvasSizePicker';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CanvasSizePicker', () => {
  it('applies custom dimensions without resetting through the default custom preset', () => {
    const onPresetChange = vi.fn();
    const onCustomSize = vi.fn();
    let root: ReactTestRenderer | undefined;

    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    act(() => {
      root = create(
        <CanvasSizePicker
          presetId="leaderboard"
          width={970}
          height={250}
          onPresetChange={onPresetChange}
          onCustomSize={onCustomSize}
        />,
      );
    });

    const trigger = root!.root.findByProps({ 'aria-haspopup': 'dialog' });
    act(() => {
      trigger.props.onClick();
    });

    const widthInput = root!.root.findByProps({ 'aria-label': 'Custom canvas width' });
    const heightInput = root!.root.findByProps({ 'aria-label': 'Custom canvas height' });
    act(() => {
      widthInput.props.onChange({ target: { value: '640' } });
      heightInput.props.onChange({ target: { value: '360' } });
    });

    const applyButton = root!.root.findByProps({ 'aria-label': 'Apply custom size' });
    act(() => {
      applyButton.props.onClick();
    });

    expect(onPresetChange).not.toHaveBeenCalled();
    expect(onCustomSize).toHaveBeenCalledWith(640, 360);
  });
});
