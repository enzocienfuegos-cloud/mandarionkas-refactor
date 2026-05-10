import { describe, expect, it } from 'vitest';
import { getCapabilityPills, getMetadataPills, getMraidLabel } from '../../../app/shell/left-rail/WidgetLibrarySection';
import { groupDefinition } from '../../../widgets/group/group.definition';
import { imageDefinition } from '../../../widgets/image/image.definition';
import { InteractiveVideoDefinition } from '../../../widgets/modules/definitions/interactive-video.definition';

describe('widget library card helpers', () => {
  it('formats metadata from the widget definition when available', () => {
    expect(getMetadataPills(InteractiveVideoDefinition)).toEqual([
      '9:16 · 320×568',
      'MRAID review',
      'Needs assets',
    ]);
  });

  it('maps widget capabilities into short visible pills', () => {
    expect(getCapabilityPills(InteractiveVideoDefinition)).toEqual([
      'Media',
      'Asset swap',
      'Analytics',
    ]);
    expect(getCapabilityPills(groupDefinition)).toEqual(['Container']);
    expect(getCapabilityPills(imageDefinition)).toEqual(['Media', 'Asset swap']);
  });

  it('formats mraid labels for the card metadata strip', () => {
    expect(getMraidLabel('supported')).toBe('MRAID ready');
    expect(getMraidLabel('warning')).toBe('MRAID review');
    expect(getMraidLabel('blocked')).toBe('MRAID blocked');
    expect(getMraidLabel(undefined)).toBeNull();
  });
});
