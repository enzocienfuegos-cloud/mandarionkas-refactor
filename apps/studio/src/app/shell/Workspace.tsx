import { Stage } from '../../canvas/stage/Stage';

type WorkspaceProps = {
  onOpenAssetLibrary(): void;
};

export function Workspace({ onOpenAssetLibrary }: WorkspaceProps): JSX.Element {
  return (
    <main className="workspace">
      <Stage onOpenAssetLibrary={onOpenAssetLibrary} />
    </main>
  );
}
