import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

type ClientCardProps = {
  client: { id: string; name: string; plan?: string; brandColor?: string };
  activeCount: number;
  sharedCount: number;
  recentProjectName: string;
  onOpen(): void;
};

function Card({ client, activeCount, sharedCount, recentProjectName, onOpen }: ClientCardProps): JSX.Element {
  return (
    <article className="agency-client-card-v2">
      <div className="agency-client-card-v2__header">
        <div className="agency-client-card-v2__avatar" aria-hidden="true">
          {client.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="agency-client-card-v2__title">
          <strong>{client.name}</strong>
          <small>{client.plan ?? 'studio'}</small>
        </div>
      </div>
      <div className="agency-client-card-v2__stats">
        <span className="pill">{activeCount} active</span>
        {sharedCount > 0 ? <span className="pill">{sharedCount} shared</span> : null}
      </div>
      <p className="agency-client-card-v2__recent">
        <span className="workspace-project-meta-label">Last project</span>
        <strong>{recentProjectName || 'No projects yet'}</strong>
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={onOpen}
        iconAfter={<StudioIcon icon={StudioIcons.arrowRight} size={14} />}
      >
        Open workspace
      </Button>
    </article>
  );
}

export const ClientGrid = { Card };
