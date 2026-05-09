import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import {
  getDocumentInspectorPanelsForTab,
  getDocumentInspectorTabs,
} from '../../../inspector/document-inspector-registry';

describe('document inspector registry', () => {
  it('returns the built-in tabs in the expected order', () => {
    const state = createInitialState();
    const tabs = getDocumentInspectorTabs(state);

    expect(tabs.map((tab) => tab.id)).toEqual(['overview', 'data', 'collab']);
  });

  it('keeps the data tab but hides the feed catalog panel for unsupported channels', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'meta-story';

    const tabs = getDocumentInspectorTabs(state);
    const dataTab = tabs.find((tab) => tab.id === 'data');

    expect(dataTab).toBeDefined();
    expect(getDocumentInspectorPanelsForTab(dataTab!, state).map((panel) => panel.key)).toEqual(['brand-kit', 'variant-rules', 'imports-diagnostics']);
  });

  it('shows feed catalog when the channel supports it', () => {
    const state = createInitialState();
    const dataTab = getDocumentInspectorTabs(state).find((tab) => tab.id === 'data');

    expect(getDocumentInspectorPanelsForTab(dataTab!, state).map((panel) => panel.key)).toEqual([
      'brand-kit',
      'variant-rules',
      'feed-catalog',
      'imports-diagnostics',
    ]);
  });
});
