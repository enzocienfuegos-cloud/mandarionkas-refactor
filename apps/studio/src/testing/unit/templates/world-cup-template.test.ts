import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createProjectStarterState, getProjectStarters } from '../../../app/shell/topbar/project-starters';
import { getTemplate } from '../../../templates/library/registry';

const EXPECTED_DOCUMENT_SHA256 = '4b055a82e30f16049f5418f2d71d6bd8bd0b015d2c2cee406a3705c461c58c9d';
const EXPECTED_DOCUMENT_LENGTH = 47423;

function withDeterministicRandom<T>(callback: () => T): T {
  const originalRandom = Math.random;
  let seed = 123456789;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

describe('world cup template library', () => {
  it('registers the world cup starter in the template registry and starter menu', () => {
    const template = getTemplate('bocadeli-worldcup');
    expect(template?.metadata.name).toBe('Bocadeli World Cup starter');

    const starterIds = getProjectStarters().map((starter) => starter.id);
    expect(starterIds).toContain('bocadeli-worldcup');
  });

  it('preserves the seeded document contract through project starters', () => {
    const state = withDeterministicRandom(() => createProjectStarterState({
      starterId: 'bocadeli-worldcup',
      name: 'World Cup Launch',
      canvasPresetId: 'interstitial',
      clientId: 'client_123',
      clientName: 'Bocadeli',
      brandName: 'Buenachos',
      campaignName: 'World Cup 2026',
    }));

    const json = JSON.stringify(state.document);
    const hash = createHash('sha256').update(json).digest('hex');

    expect(hash).toBe(EXPECTED_DOCUMENT_SHA256);
    expect(json.length).toBe(EXPECTED_DOCUMENT_LENGTH);
  });
});
