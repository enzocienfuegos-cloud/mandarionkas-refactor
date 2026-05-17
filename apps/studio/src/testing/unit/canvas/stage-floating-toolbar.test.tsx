import { create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { StageFloatingToolbar } from '../../../canvas/stage/components/StageFloatingToolbar';

function buildToolbar(previewMode: boolean) {
  return create(
    <StageFloatingToolbar
      toolbarRef={{ current: null }}
      toolbarCollapsed={false}
      toolbarStyle={{}}
      sceneName="Scene 1"
      previewMode={previewMode}
      stageBackdrop="dark"
      showStageRulers={false}
      editModeWireframe={false}
      zoom={1}
      onPointerDown={vi.fn()}
      onPointerMove={vi.fn()}
      onPointerUp={vi.fn()}
      onPointerCancel={vi.fn()}
      onToggleCollapsed={vi.fn()}
      onPreviousScene={vi.fn()}
      onNextScene={vi.fn()}
      onToggleRulers={vi.fn()}
      onToggleWireframe={vi.fn()}
      onSetBackdrop={vi.fn()}
      onZoomOut={vi.fn()}
      onZoomIn={vi.fn()}
      onFitToViewport={vi.fn()}
      onResetInteractions={vi.fn()}
    />,
  );
}

describe('StageFloatingToolbar', () => {
  it('shows reset interactions in preview mode', () => {
    const root = buildToolbar(true);

    const resetButtons = root.root.findAll((node) => node.type === 'span' && node.props.className === 'btn__label' && node.children.join('') === 'Reset interactions');
    expect(resetButtons).toHaveLength(1);
  });

  it('hides reset interactions outside preview mode', () => {
    const root = buildToolbar(false);

    const resetButtons = root.root.findAll((node) => node.type === 'button' && node.props['aria-label'] === 'Reset interactions');
    expect(resetButtons).toHaveLength(0);
  });
});
