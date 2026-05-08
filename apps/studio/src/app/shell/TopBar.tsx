import { TopBarProjectName } from './topbar/TopBarProjectName';
import { TopBarActions } from './topbar/TopBarActions';
import { useTopBarController } from './topbar/use-top-bar-controller';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { TopBarCenterContent } from './topbar/TopBarCenterContent';

type TopBarProps = {
  onOpenWorkspaceHub(): void;
  onOpenAssets(): void;
};

export function TopBar({ onOpenWorkspaceHub, onOpenAssets }: TopBarProps): JSX.Element {
  const controller = useTopBarController();

  return (
    <header className="top-bar top-bar-ux">
      <div className="top-bar-left-cluster">
        <IconButton
          className="top-back-button compact-action"
          size="lg"
          label="Go back to workspace"
          icon={<StudioIcon icon={StudioIcons.arrowLeft} size={18} />}
          onClick={onOpenWorkspaceHub}
        />
        <TopBarProjectName controller={controller} />
      </div>
      <div className="top-bar-center top-bar-center--ux">
        <TopBarCenterContent controller={controller} onOpenAssets={onOpenAssets} />
      </div>
      <TopBarActions controller={controller} />
    </header>
  );
}
