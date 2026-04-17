import type { JSX } from 'react';
import type { SummaryCardData } from './types';

type SummaryCardProps = {
  card: SummaryCardData;
};

export function SummaryCard({ card }: SummaryCardProps): JSX.Element {
  return (
    <article className={`workspace-admin-summary-card tone-${card.tone}`}>
      <div className="workspace-admin-summary-label">{card.label}</div>
      <div className="workspace-admin-summary-value">{card.value}</div>
      <div className="workspace-admin-summary-helper">{card.helper}</div>
    </article>
  );
}
