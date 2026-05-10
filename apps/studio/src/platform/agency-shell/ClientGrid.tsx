import type { AgencyClientCard } from './use-agency-shell-controller';

type ClientCardProps = {
  clientCard: AgencyClientCard;
  onOpen(): void;
};

function formatLastActivity(value?: string): string {
  if (!value) return 'Sin actualizaciones';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return formatter.format(-days, 'day');
  return new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function buildClientInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CL';
}

function Card({ clientCard, onOpen }: ClientCardProps): JSX.Element {
  const {
    client,
    activeProjectCount,
    sharedProjectCount,
    recentProjectName,
    latestActivityAt,
    brandKitCount,
    palette,
    statusLabel,
  } = clientCard;

  return (
    <article className="client-card">
      <button type="button" className="client-card-btn" onClick={onOpen}>
        <div className="client-card-header">
          <div className="client-card-avatar" aria-hidden="true">
            {client.logoUrl ? <img src={client.logoUrl} alt="" /> : <span>{buildClientInitials(client.name)}</span>}
          </div>
          <div className="client-card-title">
            <strong>{client.name}</strong>
            <small>{client.plan ?? 'studio'}</small>
          </div>
          <span className={`sbadge sbadge--client-${statusLabel === 'Compartido' ? 'shared' : statusLabel === 'En progreso' ? 'active' : 'idle'}`}>
            {statusLabel}
          </span>
        </div>

        <div className="client-card-meta">
          <span>{activeProjectCount} activos</span>
          <span>{sharedProjectCount} compartidos</span>
          <span>{brandKitCount} brand kits</span>
        </div>

        <div className="client-card-brand">
          <span className="client-recent-label">Brand system</span>
          {palette.length > 0 ? (
            <div className="client-card-swatches" aria-hidden="true">
              {palette.map((color) => (
                <svg key={color} viewBox="0 0 12 12" focusable="false" aria-hidden="true">
                  <circle cx="6" cy="6" r="5" fill={color} />
                </svg>
              ))}
            </div>
          ) : (
            <small>Sin kit cargado todavía</small>
          )}
        </div>

        <div className="client-card-recent">
          <span className="client-recent-label">Último trabajo</span>
          <strong>{recentProjectName || 'Sin proyectos todavía'}</strong>
          <small>{formatLastActivity(latestActivityAt)}</small>
        </div>
      </button>
    </article>
  );
}

export const ClientGrid = { Card };
