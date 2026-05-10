const interactiveVideoAnalyticsPanelStyle = {
  position: 'absolute',
  right: 10,
  bottom: 10,
  width: 'min(320px, 72%)',
  maxHeight: '42%',
  overflow: 'auto',
  padding: '10px 12px',
  borderRadius: 12,
  background: 'var(--surface-analytics-panel)',
  border: '1px solid var(--white-a-08)',
  color: 'var(--text-analytics-panel)',
  fontSize: 11,
  lineHeight: 1.35,
  backdropFilter: 'blur(8px)',
} as const;

const interactiveVideoAnalyticsHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 8,
} as const;

const interactiveVideoAnalyticsCountStyle = {
  opacity: 0.7,
} as const;

const interactiveVideoAnalyticsEmptyStyle = {
  opacity: 0.72,
} as const;

const interactiveVideoAnalyticsRowStyle = {
  padding: '6px 0',
  borderTop: '1px solid var(--white-a-06)',
} as const;

const interactiveVideoAnalyticsRowHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
} as const;

const interactiveVideoAnalyticsEventNameStyle = {
  fontWeight: 700,
} as const;

const interactiveVideoAnalyticsEventTimeStyle = {
  opacity: 0.65,
} as const;

const interactiveVideoAnalyticsMetadataStyle = {
  opacity: 0.76,
  marginTop: 2,
  wordBreak: 'break-word',
} as const;

type InteractiveVideoAnalyticsEvent = {
  id: string;
  name: string;
  at: number;
  metadata?: Record<string, unknown>;
};

export function InteractiveVideoAnalyticsPanel({
  analyticsEvents,
  analyticsLimit,
}: {
  analyticsEvents: InteractiveVideoAnalyticsEvent[];
  analyticsLimit: number;
}): JSX.Element {
  return (
    <div style={interactiveVideoAnalyticsPanelStyle}>
      <div style={interactiveVideoAnalyticsHeaderStyle}>
        <strong>Analytics</strong>
        <span style={interactiveVideoAnalyticsCountStyle}>{analyticsEvents.length}/{analyticsLimit}</span>
      </div>
      {analyticsEvents.length === 0 ? (
        <div style={interactiveVideoAnalyticsEmptyStyle}>No events yet.</div>
      ) : analyticsEvents.slice().reverse().map((event) => (
        <div key={event.id} style={interactiveVideoAnalyticsRowStyle}>
          <div style={interactiveVideoAnalyticsRowHeaderStyle}>
            <span style={interactiveVideoAnalyticsEventNameStyle}>{event.name}</span>
            <span style={interactiveVideoAnalyticsEventTimeStyle}>{new Date(event.at).toLocaleTimeString()}</span>
          </div>
          {event.metadata && Object.keys(event.metadata).length > 0 ? (
            <div style={interactiveVideoAnalyticsMetadataStyle}>
              {JSON.stringify(event.metadata)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
