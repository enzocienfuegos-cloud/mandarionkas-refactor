import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

type StudioTopbarAction = {
  label: string;
  onClick(): void;
  disabled?: boolean;
};

type StudioTopbarUser = {
  label: string;
  detail?: string;
  avatarText?: string;
};

type StudioTopbarProps = {
  eyebrow: string;
  title: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange(value: string): void;
  primaryAction: StudioTopbarAction;
  secondaryAction?: StudioTopbarAction;
  userLabel?: string;
  user?: StudioTopbarUser;
  onLogout?(): void;
  showLogout?: boolean;
  backAction?: StudioTopbarAction;
  className?: string;
};

export function StudioTopbar({
  eyebrow,
  title,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  primaryAction,
  secondaryAction,
  userLabel,
  user,
  onLogout,
  showLogout = true,
  backAction,
  className = '',
}: StudioTopbarProps): JSX.Element {
  const userLabelValue = user?.label ?? userLabel ?? 'Invitado';

  return (
    <header className={`studio-shell-topbar ${className}`.trim()}>
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

        {secondaryAction ? (
          <Button
            variant="ghost"
            size="md"
            className="compact-action studio-shell-topbar__action studio-shell-topbar__action--ghost"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
          >
            {secondaryAction.label}
          </Button>
        ) : null}

        <Button
          variant="primary"
          size="md"
          className="compact-action studio-shell-topbar__action studio-shell-topbar__action--primary"
          iconBefore={<StudioIcon icon={StudioIcons.plus} size={13} />}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
        >
          {primaryAction.label}
        </Button>

        {user ? (
          <div className="studio-shell-topbar__user">
            <span className="studio-shell-topbar__user-avatar" aria-hidden="true">
              {user.avatarText ?? user.label.slice(0, 2).toUpperCase()}
            </span>
            <div className="studio-shell-topbar__user-meta">
              <strong>{user.label}</strong>
              {user.detail ? <small>{user.detail}</small> : null}
            </div>
          </div>
        ) : (
          <span className="studio-shell-topbar__user-pill">{userLabelValue}</span>
        )}

        {showLogout && onLogout ? (
          <Button
            variant="ghost"
            size="sm"
            className="compact-action studio-shell-topbar__action studio-shell-topbar__action--ghost"
            iconBefore={<StudioIcon icon={StudioIcons.logOut} size={12} />}
            onClick={onLogout}
          >
            Salir
          </Button>
        ) : null}
      </div>
    </header>
  );
}
