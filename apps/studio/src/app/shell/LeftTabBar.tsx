import type { StudioState } from '../../domain/document/types';

const TABS: Array<{ key: StudioState['ui']['activeLeftTab']; label: string; icon: string }> = [
  { key: 'widgets', label: 'Widgets', icon: '▦' },
  { key: 'layers', label: 'Layers', icon: '☰' },
  { key: 'assets', label: 'Assets', icon: '◫' },
  { key: 'flow', label: 'Flow', icon: '⇄' },
];

export function LeftTabBar({ activeTab, onSelectTab, onOpenMore }: { activeTab: StudioState['ui']['activeLeftTab']; onSelectTab: (tab: StudioState['ui']['activeLeftTab']) => void; onOpenMore: () => void }): JSX.Element {
  return (
    <div className="left-tab-bar">
      <div className="left-tab-list">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`left-tab-button ${activeTab === tab.key ? 'is-active' : ''}`}
            title={tab.label}
            aria-label={tab.label}
            onClick={() => onSelectTab(tab.key)}
          >
            <span>{tab.icon}</span>
          </button>
        ))}
      </div>
      <button type="button" className="left-tab-button left-tab-button--gear" title="More" aria-label="More" onClick={onOpenMore}>⚙</button>
    </div>
  );
}
