import { Button } from '../../shared/ui/Button';

type ClientRailItem = {
  id: string;
  name: string;
  plan?: string;
  activeCount: number;
  sharedCount: number;
  recentProjectName: string;
};

export function ClientRail({
  items,
  activeClientId,
  onSelect,
  onOpen,
}: {
  items: ClientRailItem[];
  activeClientId: string;
  onSelect(clientId: string): void;
  onOpen(clientId: string): void;
}): JSX.Element {
  return (
    <section className="agency-side-rail">
      <div className="agency-side-rail__head">
        <div>
          <div className="workspace-hub-kicker">Pinned clients</div>
          <h2>Client rail</h2>
        </div>
        <span className="pill">{items.length}</span>
      </div>
      <div className="agency-client-rail">
        {items.map((client) => (
          <article
            key={client.id}
            className={`agency-client-rail-card ${activeClientId === client.id ? 'is-active' : ''}`.trim()}
          >
            <button type="button" className="agency-client-rail-card__main" onClick={() => onSelect(client.id)}>
              <div>
                <h3>{client.name}</h3>
                <p>{client.recentProjectName}</p>
              </div>
              <span className="pill">{client.plan ?? 'studio'}</span>
            </button>
            <div className="agency-client-rail-card__meta">
              <span className="pill">{client.activeCount} active</span>
              <span className="pill">{client.sharedCount} shared</span>
            </div>
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => onOpen(client.id)}>
              Open workspace
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
