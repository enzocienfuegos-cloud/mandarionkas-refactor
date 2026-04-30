import { TopBarProjectName } from './topbar/TopBarProjectName';
import { TopBarActions } from './topbar/TopBarActions';
import { useTopBarController } from './topbar/use-top-bar-controller';

type TopBarProps = {
  onOpenWorkspaceHub(): void;
  onOpenAssets(): void;
};

export function TopBar({ onOpenWorkspaceHub, onOpenAssets }: TopBarProps): JSX.Element {
  const controller = useTopBarController();

  return (
    <header className="top-bar top-bar-ux">
      <div className="top-bar-left-cluster">
        <button className="ghost compact-action top-back-button" type="button" onClick={onOpenWorkspaceHub} aria-label="Go back to workspace">
          ←
        </button>
        <TopBarProjectName controller={controller} />
      </div>
      <div className="top-bar-center top-bar-center--ux">
        <button className="ghost compact-action" type="button" onClick={onOpenAssets}>Library</button>
      </div>
      <TopBarActions controller={controller} />
    </header>
  );
}
