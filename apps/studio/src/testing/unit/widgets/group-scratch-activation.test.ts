import { describe, expect, it } from 'vitest';
import { getScratchActivationDelayMs, isScratchGroupActive } from '../../../widgets/group/group-scratch-activation';

describe('group scratch activation timing', () => {
  it('uses custom activation delay as the exact default timing', () => {
    const group = {
      id: 'group_1',
      type: 'group',
      props: {
        scratchEnabled: true,
        scratchActivationDelayMs: 200,
      },
      motion: {
        templateId: 'fade-in',
        config: { durationMs: 500, delayMs: 100 },
      },
      timeline: { startMs: 0, endMs: 5000 },
      childIds: ['text_1', 'cta_1'],
    } as any;

    const widgetsById = {
      group_1: group,
      text_1: {
        id: 'text_1',
        type: 'text',
        props: {},
        motion: {
          templateId: 'appear',
          config: { durationMs: 700, delayMs: 150 },
        },
        timeline: { startMs: 0, endMs: 5000 },
      },
      cta_1: {
        id: 'cta_1',
        type: 'cta',
        props: {},
        motion: {
          templateId: 'pulse',
          config: { durationMs: 600, delayMs: 0 },
        },
        timeline: { startMs: 0, endMs: 5000 },
      },
    } as any;

    expect(getScratchActivationDelayMs(group, widgetsById)).toBe(200);
    expect(isScratchGroupActive({ group, widgetsById, playheadMs: 199 })).toBe(false);
    expect(isScratchGroupActive({ group, widgetsById, playheadMs: 200 })).toBe(true);
  });

  it('can optionally wait for the longest motion in the group subtree plus delay', () => {
    const group = {
      id: 'group_1',
      type: 'group',
      props: {
        scratchEnabled: true,
        scratchActivationMode: 'after-motion',
        scratchActivationDelayMs: 200,
      },
      motion: {
        templateId: 'fade-in',
        config: { durationMs: 500, delayMs: 100 },
      },
      timeline: { startMs: 0, endMs: 5000 },
      childIds: ['text_1', 'cta_1'],
    } as any;

    const widgetsById = {
      group_1: group,
      text_1: {
        id: 'text_1',
        type: 'text',
        props: {},
        motion: {
          templateId: 'appear',
          config: { durationMs: 700, delayMs: 150 },
        },
        timeline: { startMs: 0, endMs: 5000 },
      },
      cta_1: {
        id: 'cta_1',
        type: 'cta',
        props: {},
        motion: {
          templateId: 'pulse',
          config: { durationMs: 600, delayMs: 0 },
        },
        timeline: { startMs: 0, endMs: 5000 },
      },
    } as any;

    expect(getScratchActivationDelayMs(group, widgetsById)).toBe(1050);
    expect(isScratchGroupActive({ group, widgetsById, playheadMs: 1049 })).toBe(false);
    expect(isScratchGroupActive({ group, widgetsById, playheadMs: 1050 })).toBe(true);
  });
});
