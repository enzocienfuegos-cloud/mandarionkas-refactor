import { TopBarProjectName } from './topbar/TopBarProjectName';
import { TopBarActions } from './topbar/TopBarActions';
import { useTopBarController } from './topbar/use-top-bar-controller';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { TopBarCenterContent } from './topbar/TopBarCenterContent';
import { SmxLogo } from '../../assets/SmxLogo';

type TopBarProps = {
  onOpenWorkspaceHub(): void;
  onOpenAssetLibrary(): void;
  onOpenBrandKitDrawer(): void;
};

export function TopBar({ onOpenWorkspaceHub, onOpenAssetLibrary, onOpenBrandKitDrawer }: TopBarProps): JSX.Element {
  const controller = useTopBarController();

  return (
    <header className={`top-bar top-bar-ux ${controller.snapshot.previewMode ? 'is-preview-mode' : ''}`.trim()}>
      <div className="top-bar-left-cluster">
        <IconButton
          className="top-back-button"
          size="sm"
          label="Go back to workspace"
          tooltip="Back to workspace"
          tooltipPlacement="bottom"
          tooltipDelay={240}
          icon={<StudioIcon icon={StudioIcons.arrowLeft} size={16} />}
          onClick={onOpenWorkspaceHub}
        />
        <SmxLogo className="smx-topbar-logo" />
        <div className="top-bar-divider" aria-hidden="true" />
        <TopBarProjectName controller={controller} />
      </div>
      <div className="top-bar-center top-bar-center--ux">
        <TopBarCenterContent controller={controller} />
      </div>
      <TopBarActions
        controller={controller}
        onOpenAssetLibrary={onOpenAssetLibrary}
        onOpenBrandKitDrawer={onOpenBrandKitDrawer}
      />
    </header>
  );
}
