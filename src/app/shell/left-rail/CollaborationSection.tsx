import type { LeftRailController } from './use-left-rail-controller';

export function CollaborationSection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { openComments, pendingApprovals, scene } = controller;

  return (
    <div className="field-stack">
      <div>
        <div className="left-title">More</div>
        <strong className="rail-heading">Collaboration</strong>
      </div>
      <div className="pill">Open comments {openComments}</div>
      <div className="pill">Pending approvals {pendingApprovals}</div>
      <div className="left-title">Studio mode</div>
      <small className="muted">Secondary workspace info lives here so the main rail stays focused on creation.</small>
      <div className="pill">Scene {scene.name}</div>
    </div>
  );
}
