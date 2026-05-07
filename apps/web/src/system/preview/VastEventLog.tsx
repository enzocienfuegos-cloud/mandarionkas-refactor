import React from 'react';
import { Badge, Kicker } from '../primitives/Badge';
import { Panel } from '../primitives/Panel';

const DEFAULT_EVENTS = ['start', 'q1', 'midpoint', 'q3', 'complete', 'click'];

export interface VastEventLogProps {
  events?: string[];
  liveEnabled?: boolean;
}

export function VastEventLog({ events = [], liveEnabled = false }: VastEventLogProps) {
  const seen = new Set(events.map((event) => String(event).trim().toLowerCase()));

  return (
    <Panel padding="md" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Kicker>VAST events</Kicker>
          <p className="mt-1 text-sm text-text-muted">
            {liveEnabled
              ? 'Preview player callbacks will appear here as the ad progresses.'
              : 'UI contract ready for player callbacks. Live VAST instrumentation still needs player integration.'}
          </p>
        </div>
        <Badge tone={liveEnabled ? 'info' : 'neutral'}>
          {liveEnabled ? 'Live' : 'Placeholder'}
        </Badge>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {DEFAULT_EVENTS.map((eventName) => {
          const hit = seen.has(eventName);
          return (
            <li
              key={eventName}
              className="flex items-center justify-between rounded-lg border border-border-default bg-surface-1 px-3 py-2"
            >
              <span className="text-sm font-medium text-text-primary">{eventName}</span>
              <Badge tone={hit ? 'success' : 'neutral'}>{hit ? 'Seen' : 'Pending'}</Badge>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
