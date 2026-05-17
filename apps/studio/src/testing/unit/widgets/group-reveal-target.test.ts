import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import {
  getScratchRevealTargetId,
  getScratchRevealTargetMode,
  isRevealTargetCandidate,
  isWidgetTargetedByScratchGroup,
} from '../../../widgets/group/group-reveal-target';

function createWidget(overrides: Partial<WidgetNode> & Pick<WidgetNode, 'id' | 'type'>): WidgetNode {
  return {
    id: overrides.id,
    type: overrides.type,
    name: overrides.name ?? overrides.id,
    sceneId: overrides.sceneId ?? 'scene_1',
    zIndex: overrides.zIndex ?? 1,
    frame: overrides.frame ?? { x: 0, y: 0, width: 120, height: 60, rotation: 0 },
    props: overrides.props ?? {},
    style: overrides.style ?? { opacity: 1 },
    timeline: overrides.timeline ?? { startMs: 0, endMs: 1500 },
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    hidden: overrides.hidden,
    locked: overrides.locked,
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    bindings: overrides.bindings,
    variants: overrides.variants,
    conditions: overrides.conditions,
    sharedLayerId: overrides.sharedLayerId,
  };
}

describe('group reveal target', () => {
  it('defaults to auto mode with an empty target id', () => {
    const group = createWidget({ id: 'group_1', type: 'group' });

    expect(getScratchRevealTargetMode(group)).toBe('auto');
    expect(getScratchRevealTargetId(group)).toBe('');
  });

  it('matches an explicitly targeted widget group through its descendants', () => {
    const scratchGroup = createWidget({
      id: 'scratch_group',
      type: 'group',
      props: {
        scratchEnabled: true,
        revealTargetMode: 'widget',
        revealTargetId: 'reveal_group',
      },
    });
    const revealGroup = createWidget({
      id: 'reveal_group',
      type: 'group',
      childIds: ['text_1'],
    });
    const revealText = createWidget({
      id: 'text_1',
      type: 'text',
      parentId: 'reveal_group',
    });

    expect(isWidgetTargetedByScratchGroup(scratchGroup, revealGroup, {
      scratch_group: scratchGroup,
      reveal_group: revealGroup,
      text_1: revealText,
    })).toBe(true);
    expect(isWidgetTargetedByScratchGroup(scratchGroup, revealText, {
      scratch_group: scratchGroup,
      reveal_group: revealGroup,
      text_1: revealText,
    })).toBe(true);
  });

  it('matches all widgets in a targeted scene', () => {
    const scratchGroup = createWidget({
      id: 'scratch_group',
      type: 'group',
      sceneId: 'scene_1',
      props: {
        scratchEnabled: true,
        revealTargetMode: 'scene',
        revealTargetId: 'scene_2',
      },
    });
    const revealImage = createWidget({
      id: 'image_1',
      type: 'image',
      sceneId: 'scene_2',
    });

    expect(isWidgetTargetedByScratchGroup(scratchGroup, revealImage, {
      scratch_group: scratchGroup,
      image_1: revealImage,
    })).toBe(true);
  });

  it('excludes the scratch group subtree from reveal target candidates', () => {
    const scratchGroup = createWidget({
      id: 'scratch_group',
      type: 'group',
      childIds: ['cover_text'],
    });
    const coverText = createWidget({
      id: 'cover_text',
      type: 'text',
      parentId: 'scratch_group',
    });
    const revealText = createWidget({
      id: 'reveal_text',
      type: 'text',
    });

    expect(isRevealTargetCandidate(scratchGroup, coverText, {
      scratch_group: scratchGroup,
      cover_text: coverText,
      reveal_text: revealText,
    })).toBe(false);
    expect(isRevealTargetCandidate(scratchGroup, revealText, {
      scratch_group: scratchGroup,
      cover_text: coverText,
      reveal_text: revealText,
    })).toBe(true);
  });
});
