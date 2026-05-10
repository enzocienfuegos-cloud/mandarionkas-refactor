import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

type ReviewActivityRailProps = {
  recentActivity: Array<{
    id: string;
    actorName: string;
    projectName: string;
    action: string;
    createdAt: string;
    projectId?: string;
  }>;
  onResumeProject?(projectId: string): void;
};

function formatRelativeTime(value: string): string {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function iconForAction(action: string) {
  if (action.includes('export')) return StudioIcons.download;
  if (action.includes('share') || action.includes('comment')) return StudioIcons.workflow;
  return StudioIcons.library;
}

export function ReviewActivityRail({
  recentActivity,
  onResumeProject,
}: ReviewActivityRailProps): JSX.Element {
  return (
    <section className="agency-activity-feed panel" aria-labelledby="agency-activity-heading">
      <div className="agency-activity-feed__head">
        <div>
          <div className="workspace-hub-kicker">Recent activity</div>
          <h2 id="agency-activity-heading">Keep moving through live work</h2>
        </div>
      </div>

      <div className="agency-activity-feed__list">
        {recentActivity.map((entry) => (
          <article key={entry.id} className="agency-activity-item">
            <div className="agency-activity-item__icon" aria-hidden="true">
              <StudioIcon icon={iconForAction(entry.action)} size={14} />
            </div>
            <div className="agency-activity-item__copy">
              <strong>{entry.projectName}</strong>
              <p>{entry.actorName} {entry.action}</p>
              <small>{formatRelativeTime(entry.createdAt)}</small>
            </div>
            {entry.projectId && onResumeProject ? (
              <Button variant="ghost" size="sm" className="compact-action" onClick={() => onResumeProject(entry.projectId!)}>
                Open
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
