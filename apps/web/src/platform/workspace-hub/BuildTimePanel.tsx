import type { JSX } from 'react';
import type { BuildTimeSnapshot } from './types';

type BuildTimePanelProps = {
  snapshot: BuildTimeSnapshot;
};

export function BuildTimePanel({ snapshot }: BuildTimePanelProps): JSX.Element {
  return (
    <section className="workspace-admin-side-card">
      <div className="workspace-admin-side-card-head">
        <div>
          <h3>Build time</h3>
          <p>Delivery efficiency by format during the last 7 days.</p>
        </div>
      </div>
      <div className="workspace-admin-build-metrics">
        <div className="workspace-admin-build-stat">
          <span>Average build time</span>
          <strong>{snapshot.averageDays}</strong>
          <small>{snapshot.deltaLabel}</small>
        </div>
        <div className="workspace-admin-build-stat">
          <span>Slow projects</span>
          <strong>{snapshot.slowProjects}</strong>
          <small>Taking longer than expected</small>
        </div>
      </div>
      <div className="workspace-admin-build-format-list">
        {snapshot.byFormat.map((item) => (
          <div key={item.format} className="workspace-admin-build-row">
            <div className="workspace-admin-build-row-copy">
              <span>{item.format}</span>
              <small>{item.days}</small>
            </div>
            <div className="workspace-admin-build-row-track">
              <div className={`workspace-admin-build-row-fill tone-${item.tone}`} style={{ width: `${item.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
