import type { TopBarController } from './use-top-bar-controller';

export function TopBarProjectName({ controller }: { controller: TopBarController }): JSX.Element {
  const { name, dirty } = controller.snapshot;
  const { documentActions } = controller.document;

  return (
    <div className="top-brand-row top-brand-row--ux">
      <span className="brand-mark">SMX Studio</span>
      <div className="top-name-block">
        <div className="top-name-row">
          <input aria-label="Document name" value={name} onChange={(event) => { documentActions.updateName(event.target.value); }} className="doc-name-input doc-name-input--ux" />
          <span className={`top-dirty-dot ${dirty ? 'is-dirty' : 'is-clean'}`} aria-label={dirty ? 'Unsaved changes' : 'Saved'} />
        </div>
        <small className="muted">{dirty ? 'Unsaved changes' : 'Project title'}</small>
      </div>
    </div>
  );
}
