import type { StudioState } from '../../domain/document/types';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

const TABS: Array<{ key: StudioState['ui']['activeLeftTab']; label: string; icon: keyof typeof StudioIcons }> = [
  { key: 'widgets', label: 'Widgets', icon: 'boxes' },
  { key: 'layers', label: 'Layers', icon: 'layers' },
  { key: 'assets', label: 'Assets', icon: 'images' },
  { key: 'flow', label: 'Flow', icon: 'workflow' },
];

export function LeftTabBar({
  activeTab,
  onSelectTab,
  onOpenMore,
  onOpenShortcuts,
}: {
  activeTab: StudioState['ui']['activeLeftTab'];
  onSelectTab: (tab: StudioState['ui']['activeLeftTab']) => void;
  onOpenMore: () => void;
  onOpenShortcuts: () => void;
}): JSX.Element {
  return (
    <div className="left-tab-bar">
      <div className="left-tab-list">
        {TABS.map((tab) => (
          <IconButton
            key={tab.key}
            className="left-tab-button"
            size="lg"
            label={tab.label}
            isActive={activeTab === tab.key}
            pressed={activeTab === tab.key}
            tooltipPlacement="bottom"
            tooltipDelay={240}
            icon={<StudioIcon icon={StudioIcons[tab.icon]} size={18} />}
            onClick={() => onSelectTab(tab.key)}
          />
        ))}
      </div>
      <div className="left-tab-footer">
        <IconButton
          className="left-tab-button"
          size="lg"
          label="Open keyboard shortcuts"
          tooltip="Keyboard shortcuts (?)"
          tooltipPlacement="bottom"
          tooltipDelay={240}
          icon={<StudioIcon icon={StudioIcons.info} size={18} />}
          onClick={onOpenShortcuts}
        />
        <IconButton
          className="left-tab-button left-tab-button--gear"
          size="lg"
          label="Open collaboration and workspace tools"
          tooltip="Collaboration and workspace tools"
          tooltipPlacement="bottom"
          tooltipDelay={240}
          icon={<StudioIcon icon={StudioIcons.settings} size={18} />}
          onClick={onOpenMore}
        />
      </div>
    </div>
  );
}
