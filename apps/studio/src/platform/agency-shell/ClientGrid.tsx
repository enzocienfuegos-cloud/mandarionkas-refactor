import type { AgencyClientCard } from './use-agency-shell-controller';

type ClientCardProps = {
  clientCard: AgencyClientCard;
  onOpen(): void;
};

function formatLastActivity(value?: string): string {
  if (!value) return 'Sin actividad reciente';
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
  const { client, projectCount, recentProjectName, latestActivityAt, brandKitCount, palette } = clientCard;
  return (
    <article className="mandarion-client-card">
      <button type="button" className="mandarion-client-card__surface" onClick={onOpen}>
        <div className="mandarion-client-card__header">
          <div className="mandarion-client-card__avatar" aria-hidden="true">
            {client.logoUrl ? <img src={client.logoUrl} alt="" /> : <span>{buildClientInitials(client.name)}</span>}
          </div>
          <div className="mandarion-client-card__copy">
            <strong>{client.name}</strong>
            <small>{client.slug}</small>
          </div>
        </div>
        <div className="mandarion-client-card__stats">
          <span className="pill">{projectCount} proyectos activos</span>
          <span className="pill">{brandKitCount} brand kits</span>
          {client.plan ? <span className="pill">{client.plan}</span> : null}
        </div>
        <div className="mandarion-client-card__brand-kits">
          <span className="workspace-project-meta-label">Brand system</span>
          {palette.length > 0 ? (
            <div className="mandarion-client-card__swatches" aria-hidden="true">
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
        <div className="mandarion-client-card__recent">
          <span className="workspace-project-meta-label">Último proyecto</span>
          <strong>{recentProjectName}</strong>
          <small>{formatLastActivity(latestActivityAt)}</small>
        </div>
      </button>
    </article>
  );
}

export const ClientGrid = { Card };
