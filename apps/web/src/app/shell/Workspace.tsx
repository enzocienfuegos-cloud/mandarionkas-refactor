import { Stage } from '../../canvas/stage/Stage';
import { usePlatformPermission } from '../../platform/runtime';

type WorkspaceProps = {
  onOpenAssetLibrary(): void;
};

export function Workspace({ onOpenAssetLibrary }: WorkspaceProps): JSX.Element {
  const canCreateAssets = usePlatformPermission('assets:create');
  return (
    <main className="workspace">
      <Stage canCreateAssets={canCreateAssets} onOpenAssetLibrary={onOpenAssetLibrary} />
    </main>
  );
}
