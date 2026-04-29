import type { StudioState } from '../../domain/document/types';
import { AssetsIcon, FlowIcon, LayersIcon, SettingsIcon, PanelsIcon } from './ShellIcons';

const TABS: Array<{ key: StudioState['ui']['activeLeftTab']; label: string; icon: JSX.Element }> = [
  { key: 'widgets', label: 'Widgets', icon: <PanelsIcon className="shell-tab-icon" /> },
  { key: 'layers', label: 'Layers', icon: <LayersIcon className="shell-tab-icon" /> },
  { key: 'assets', label: 'Assets', icon: <AssetsIcon className="shell-tab-icon" /> },
  { key: 'flow', label: 'Flow', icon: <FlowIcon className="shell-tab-icon" /> },
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
            <span className="shell-tab-icon-wrap">{tab.icon}</span>
          </button>
        ))}
      </div>
      <button type="button" className="left-tab-button left-tab-button--gear" title="More" aria-label="More" onClick={onOpenMore}>
        <span className="shell-tab-icon-wrap">
          <SettingsIcon className="shell-tab-icon" />
        </span>
      </button>
    </div>
  );
}
