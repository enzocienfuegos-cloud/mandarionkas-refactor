import { describe, expect, it } from 'vitest';
import { buildWidgetLibrarySearchText, groupWidgetsByLibraryGroup } from '../../../app/shell/left-rail/use-left-rail-widget-library';
import { badgeDefinition } from '../../../widgets/badge/badge.definition';
import { DynamicMapDefinition } from '../../../widgets/modules/definitions/dynamic-map.definition';
import { InteractiveVideoDefinition } from '../../../widgets/modules/definitions/interactive-video.definition';
import { withWidgetLibraryMetadata } from '../../../widgets/registry/widget-library-taxonomy';

describe('widget library taxonomy', () => {
  it('applies curated library groups, tags, and rank metadata', () => {
    const badge = withWidgetLibraryMetadata(badgeDefinition);
    const map = withWidgetLibraryMetadata(DynamicMapDefinition);
    const interactiveVideo = withWidgetLibraryMetadata(InteractiveVideoDefinition);

    expect(badge.libraryGroup).toBe('essentials');
    expect(badge.libraryRank).toBe(4);
    expect(map.libraryGroup).toBe('data-utility');
    expect(map.libraryTags).toContain('locations');
    expect(interactiveVideo.libraryGroup).toBe('video-social');
    expect(interactiveVideo.libraryTags).toContain('video');
  });

  it('builds search text from group labels and tags in addition to base widget fields', () => {
    const interactiveVideo = withWidgetLibraryMetadata(InteractiveVideoDefinition);
    const searchText = buildWidgetLibrarySearchText(interactiveVideo);

    expect(searchText).toContain('video / social');
    expect(searchText).toContain('social');
    expect(searchText).toContain('hotspots');
  });

  it('groups widgets by the curated library order', () => {
    const grouped = groupWidgetsByLibraryGroup([
      withWidgetLibraryMetadata(DynamicMapDefinition),
      withWidgetLibraryMetadata(InteractiveVideoDefinition),
      withWidgetLibraryMetadata(badgeDefinition),
    ]);

    expect(grouped.map((section) => section.group)).toEqual([
      'essentials',
      'video-social',
      'data-utility',
    ]);
    expect(grouped[0]?.widgets[0]?.type).toBe('badge');
  });
});
