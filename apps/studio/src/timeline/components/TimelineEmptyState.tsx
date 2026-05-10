import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export function TimelineEmptyState({ selectedOnly }: { selectedOnly: boolean }): JSX.Element {
  return (
    <div className="timeline-empty-state" role="status" aria-live="polite">
      <div className="timeline-empty-state__icon">
        <StudioIcon icon={StudioIcons.workflow} size={18} />
      </div>
      <div className="timeline-empty-state__copy">
        <strong>{selectedOnly ? 'No selected layers in view' : 'Timeline is ready for your first layer'}</strong>
        <p>
          {selectedOnly
            ? 'Switch back to all layers or select another widget to keep editing timing.'
            : 'Add a widget from the Library to see timing bars, trim handles, and motion controls here.'}
        </p>
      </div>
      <div className="timeline-empty-state__tips">
        <span className="pill">Add widget</span>
        <span className="pill">Trim duration</span>
        <span className="pill">Animate keyframes</span>
      </div>
    </div>
  );
}
