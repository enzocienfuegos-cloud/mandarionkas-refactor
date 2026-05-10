import { Stage } from '../../canvas/stage/Stage';
import { CanvasVariantStrip } from './CanvasVariantStrip';

type WorkspaceProps = {
  onOpenAssetLibrary(): void;
};

export function Workspace({ onOpenAssetLibrary }: WorkspaceProps): JSX.Element {
  return (
    <main className="workspace">
      <CanvasVariantStrip />
      <div className="workspace-stage-shell">
        <Stage onOpenAssetLibrary={onOpenAssetLibrary} />
      </div>
    </main>
  );
}
