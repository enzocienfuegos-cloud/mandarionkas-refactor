import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

type AgencyCommandHeroProps = {
  selectedClientName: string;
  templateCount: number;
  featuredProject?: {
    name: string;
    summary: string;
    detail: string;
  } | null;
  onContinue(): void;
  onCreateCampaign(): void;
  onOpenClientWorkspace(): void;
};

export function AgencyCommandHero({
  selectedClientName,
  templateCount,
  featuredProject,
  onContinue,
  onCreateCampaign,
  onOpenClientWorkspace,
}: AgencyCommandHeroProps): JSX.Element {
  return (
    <section className="agency-command-hero">
      <div className="agency-command-hero__intro">
        <div className="workspace-hub-kicker">Agency hub</div>
        <h2>Move fast</h2>
        <p>
          The shell should feel like an edit queue instead of a dashboard. The current client lens is
          <strong> {selectedClientName}</strong>.
        </p>
      </div>

      <div className="agency-command-hero__featured">
        <div className="agency-command-hero__eyebrow">
          <span className="pill pill-highlight">Continue last project</span>
        </div>
        <h3>{featuredProject?.name ?? 'No recent project yet'}</h3>
        <p>{featuredProject?.summary ?? 'Open a project from any workspace and Studio will keep it ready here.'}</p>
        <small>{featuredProject?.detail ?? 'Once work starts, this hero becomes the fastest way back into the editor.'}</small>
        <div className="agency-command-hero__actions">
          <Button variant="primary" size="md" onClick={onContinue} disabled={!featuredProject}>
            Continue work
          </Button>
          <Button variant="ghost" size="md" onClick={onCreateCampaign}>
            New campaign
          </Button>
        </div>
      </div>

      <div className="agency-command-hero__quick-actions">
        <button type="button" className="agency-quick-action-card" onClick={onOpenClientWorkspace}>
          <span className="agency-quick-action-card__icon">
            <StudioIcon icon={StudioIcons.folder} size={18} />
          </span>
          <strong>Open client workspace</strong>
          <p>Jump into the active client context and keep briefs, templates and projects tightly scoped.</p>
        </button>
        <button type="button" className="agency-quick-action-card" onClick={onCreateCampaign}>
          <span className="agency-quick-action-card__icon">
            <StudioIcon icon={StudioIcons.plus} size={18} />
          </span>
          <strong>Start a new campaign</strong>
          <p>Use a blank canvas or jump into the curated template paths without scanning backlog metrics first.</p>
        </button>
        <div className="agency-quick-action-card agency-quick-action-card--static">
          <span className="agency-quick-action-card__icon">
            <StudioIcon icon={StudioIcons.library} size={18} />
          </span>
          <strong>Template marketplace</strong>
          <p>{templateCount} stronger launch-ready starters, led by the Bocadeli World Cup flagship flow.</p>
        </div>
      </div>
    </section>
  );
}
