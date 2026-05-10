import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

type StudioTopbarAction = {
  label: string;
  onClick(): void;
  disabled?: boolean;
};

type StudioTopbarProps = {
  eyebrow: string;
  title: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange(value: string): void;
  primaryAction: StudioTopbarAction;
  userLabel?: string;
  onLogout(): void;
  backAction?: StudioTopbarAction;
};

export function StudioTopbar({
  eyebrow,
  title,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  primaryAction,
  userLabel,
  onLogout,
  backAction,
}: StudioTopbarProps): JSX.Element {
  return (
    <header className="studio-shell-topbar">
      <div className="studio-shell-topbar__brand">
        <div className="studio-shell-topbar__logo-box" aria-hidden="true">
          <img src="/assets/mandarion-logo.svg" alt="" className="studio-shell-topbar__logo" />
        </div>
        <div className="studio-shell-topbar__brand-meta">
          <span className="studio-shell-topbar__eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
        </div>
      </div>

      <label className="studio-shell-topbar__search">
        <span className="studio-shell-topbar__search-label">{searchLabel}</span>
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </label>

      <div className="studio-shell-topbar__actions">
        {backAction ? (
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            iconBefore={<StudioIcon icon={StudioIcons.arrowLeft} size={13} />}
            onClick={backAction.onClick}
          >
            {backAction.label}
          </Button>
        ) : null}

        <Button
          variant="primary"
          size="md"
          className="compact-action"
          iconBefore={<StudioIcon icon={StudioIcons.plus} size={13} />}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
        >
          {primaryAction.label}
        </Button>

        <span className="studio-shell-topbar__user-pill">{userLabel ?? 'Invitado'}</span>

        <Button
          variant="ghost"
          size="sm"
          className="compact-action"
          iconBefore={<StudioIcon icon={StudioIcons.logOut} size={12} />}
          onClick={onLogout}
        >
          Salir
        </Button>
      </div>
    </header>
  );
}
