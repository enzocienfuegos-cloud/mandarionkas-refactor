import { Button } from '../../shared/ui/Button';

type ReviewActivityRailProps = {
  topProjects: Array<{
    id: string;
    name: string;
    workspaceName: string;
    sceneCount: number;
    widgetCount: number;
  }>;
  recentActivity: Array<{
    id: string;
    actorName: string;
    projectName: string;
    action: string;
    createdAt: string;
  }>;
  totals: {
    exports: number;
    shares: number;
    openToExportMinutes: number | null;
  };
  onResumeProject(projectId: string): void;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function ReviewActivityRail({
  topProjects,
  recentActivity,
  totals,
  onResumeProject,
}: ReviewActivityRailProps): JSX.Element {
  return (
    <section className="agency-side-rail agency-side-rail--review" id="agency-review-rail">
      <div className="agency-side-rail__head">
        <div>
          <div className="workspace-hub-kicker">Review lane</div>
          <h2>Readiness & activity</h2>
        </div>
      </div>

      <div className="agency-review-summary">
        <div className="agency-review-summary__card">
          <span className="workspace-project-meta-label">Exports</span>
          <strong>{totals.exports}</strong>
          <small>Recent export actions across visible clients</small>
        </div>
        <div className="agency-review-summary__card">
          <span className="workspace-project-meta-label">Shares</span>
          <strong>{totals.shares}</strong>
          <small>Collaboration events in the current overview window</small>
        </div>
        <div className="agency-review-summary__card">
          <span className="workspace-project-meta-label">Open → export</span>
          <strong>{totals.openToExportMinutes == null ? '—' : `${totals.openToExportMinutes}m`}</strong>
          <small>Time-to-export pulse for the agency shell</small>
        </div>
      </div>

      <div className="agency-review-list">
        <div className="agency-review-block">
          <h3>Recent activity</h3>
          {recentActivity.map((entry) => (
            <div key={entry.id} className="agency-review-row">
              <div>
                <strong>{entry.projectName}</strong>
                <p>{entry.actorName} {entry.action} · {formatDate(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="agency-review-block">
          <h3>Top projects</h3>
          {topProjects.map((project) => (
            <div key={project.id} className="agency-review-row">
              <div>
                <strong>{project.name}</strong>
                <p>{project.workspaceName} · {project.sceneCount} scenes · {project.widgetCount} widgets</p>
              </div>
              <Button variant="ghost" size="sm" className="compact-action" onClick={() => onResumeProject(project.id)}>
                Resume
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
