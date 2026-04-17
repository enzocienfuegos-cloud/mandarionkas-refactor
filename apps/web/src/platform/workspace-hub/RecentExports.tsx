import type { JSX } from 'react';
import { CheckIcon, ClockIcon } from './icons';
import type { RecentExportItem } from './types';

type RecentExportsProps = {
  items: RecentExportItem[];
};

export function RecentExports({ items }: RecentExportsProps): JSX.Element {
  return (
    <section className="workspace-admin-side-card">
      <div className="workspace-admin-side-card-head">
        <div>
          <h3>Recent exports</h3>
          <p>Latest packaged deliverables from this workspace.</p>
        </div>
      </div>
      <div className="workspace-admin-export-list">
        {items.map((item) => (
          <div key={item.id} className="workspace-admin-export-item">
            <div className={`workspace-admin-export-thumb tone-${item.tone}`}>{item.projectName.slice(0, 2).toUpperCase()}</div>
            <div className="workspace-admin-export-copy">
              <strong>{item.projectName}</strong>
              <span>{item.exportType}</span>
            </div>
            <div className="workspace-admin-export-meta">
              <small>{item.timeAgo}</small>
              {item.ok ? <CheckIcon className="workspace-admin-status-icon success" /> : <ClockIcon className="workspace-admin-status-icon" />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
