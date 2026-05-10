type ClientCardProps = {
  client: { id: string; name: string; plan?: string; brandColor?: string };
  activeCount: number;
  sharedCount: number;
  recentProjectName: string;
  recentUpdatedAt?: string;
  onOpen(): void;
};

function formatRelativeTime(value?: string): string {
  if (!value) return 'No recent updates';
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function buildStatus(activeCount: number, sharedCount: number): string {
  if (sharedCount > 0) return 'In review';
  if (activeCount > 0) return 'Campaign active';
  return 'Quiet';
}

function Card({ client, activeCount, sharedCount, recentProjectName, recentUpdatedAt, onOpen }: ClientCardProps): JSX.Element {
  return (
    <article className="agency-client-card-v2">
      <button type="button" className="agency-client-card-v2__surface" onClick={onOpen}>
        <div className="agency-client-card-v2__header">
          <div className="agency-client-card-v2__title">
            <span className="agency-client-card-v2__status-dot" />
            <div>
              <strong>{client.name}</strong>
              <small>{client.plan ?? 'studio'}</small>
            </div>
          </div>
          <span className="workspace-status-badge workspace-status-badge--review">{buildStatus(activeCount, sharedCount)}</span>
        </div>
        <div className="agency-client-card-v2__meta">
          <span>{activeCount} active projects</span>
          <span>{sharedCount} shared</span>
        </div>
        <div className="agency-client-card-v2__recent">
          <span className="workspace-project-meta-label">Last project</span>
          <strong>{recentProjectName || 'No projects yet'}</strong>
          <small>{formatRelativeTime(recentUpdatedAt)}</small>
        </div>
      </button>
    </article>
  );
}

export const ClientGrid = { Card };
