import { Button } from '../../shared/ui/Button';

type RecentWorkSliderProps = {
  projects: Array<{
    id: string;
    name: string;
    clientId?: string;
    brandName?: string;
    campaignName?: string;
    sceneCount?: number;
    widgetCount?: number;
    updatedAt?: string;
  }>;
  clients: Array<{ id: string; name: string }>;
  onResume(projectId: string, clientId?: string): void;
};

function formatDate(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export function RecentWorkSlider({ projects, clients, onResume }: RecentWorkSliderProps): JSX.Element {
  if (projects.length === 0) {
    return (
      <div className="agency-recent-empty">
        <strong>No recent work yet</strong>
        <small>Open a project from any client and it will land here for fast resume.</small>
      </div>
    );
  }

  return (
    <div className="agency-recent-rail" role="region" aria-label="Recent projects across clients">
      <ol className="agency-recent-rail__track">
        {projects.map((project) => {
          const clientName = clients.find((client) => client.id === project.clientId)?.name ?? 'Client workspace';
          return (
            <li key={project.id} className="agency-recent-card">
              <div className="agency-recent-card__body">
                <div className="agency-recent-card__eyebrow">{clientName}</div>
                <h3>{project.name}</h3>
                <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                <small>{project.sceneCount ?? 1} scenes · {project.widgetCount ?? 0} widgets · {formatDate(project.updatedAt)}</small>
              </div>
              <div className="agency-recent-card__actions">
                <Button variant="primary" size="sm" onClick={() => onResume(project.id, project.clientId)}>
                  Continue
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
