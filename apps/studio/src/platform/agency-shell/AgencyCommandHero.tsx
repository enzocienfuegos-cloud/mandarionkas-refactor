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
  onJumpToReview(): void;
};

export function AgencyCommandHero({
  selectedClientName,
  templateCount,
  featuredProject,
  onContinue,
  onCreateCampaign,
  onOpenClientWorkspace,
  onJumpToReview,
}: AgencyCommandHeroProps): JSX.Element {
  return (
    <section className="agency-command-hero">
      <div className="agency-command-hero__intro">
        <div className="workspace-hub-kicker">Agency command center</div>
        <h2>Continue campaigns, review exports, and launch client work from one place.</h2>
        <p>
          Focus the shell on the next best action instead of scanning a dashboard. The current client lens is
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
          <p>Jump into the active client context and keep briefs, templates, and projects scoped.</p>
        </button>
        <button type="button" className="agency-quick-action-card" onClick={onJumpToReview}>
          <span className="agency-quick-action-card__icon">
            <StudioIcon icon={StudioIcons.scanSearch} size={18} />
          </span>
          <strong>Review exports</strong>
          <p>See readiness and recent export-related activity without leaving the command center.</p>
        </button>
        <div className="agency-quick-action-card agency-quick-action-card--static">
          <span className="agency-quick-action-card__icon">
            <StudioIcon icon={StudioIcons.library} size={18} />
          </span>
          <strong>Template marketplace</strong>
          <p>{templateCount} launch-ready starters available across verticals and formats.</p>
        </div>
      </div>
    </section>
  );
}
