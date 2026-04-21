import { useEffect, useMemo, useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import {
  getVideoAnalyticsSummary,
  listVideoAnalyticsEvents,
  type VideoAnalyticsEventRecord,
  type VideoAnalyticsSummary,
} from '../../../repositories/video-analytics/api';

type SeriesPoint = { bucket: string; count: number };
type HoverPoint = { bucket: string; count: number };
type ComparedEvent = { eventName: string; count: number };

function formatDate(value?: string): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function formatBucket(value: string, mode: 'hour' | 'day'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return mode === 'hour'
    ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function buildSparklinePath(points: SeriesPoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  const max = Math.max(...points.map((point) => point.count), 1);
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (point.count / max) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function getEventPalette(eventName?: string): { line: string; point: string; barFrom: string; barTo: string } {
  if (!eventName) {
    return {
      line: 'rgba(99,211,255,0.95)',
      point: 'rgba(245,165,36,0.95)',
      barFrom: 'rgba(245,165,36,0.95)',
      barTo: 'rgba(99,211,255,0.92)',
    };
  }
  if (eventName.includes('error')) {
    return {
      line: 'rgba(248,113,113,0.95)',
      point: 'rgba(239,68,68,1)',
      barFrom: 'rgba(248,113,113,0.95)',
      barTo: 'rgba(251,146,60,0.92)',
    };
  }
  if (eventName.includes('click') || eventName.includes('cta')) {
    return {
      line: 'rgba(245,165,36,0.95)',
      point: 'rgba(250,204,21,1)',
      barFrom: 'rgba(245,165,36,0.95)',
      barTo: 'rgba(250,204,21,0.92)',
    };
  }
  if (eventName.includes('quartile') || eventName.includes('complete') || eventName.includes('play')) {
    return {
      line: 'rgba(74,222,128,0.95)',
      point: 'rgba(34,197,94,1)',
      barFrom: 'rgba(74,222,128,0.95)',
      barTo: 'rgba(99,211,255,0.92)',
    };
  }
  if (eventName.includes('hover') || eventName.includes('impression')) {
    return {
      line: 'rgba(167,139,250,0.95)',
      point: 'rgba(139,92,246,1)',
      barFrom: 'rgba(167,139,250,0.95)',
      barTo: 'rgba(99,211,255,0.92)',
    };
  }
  return {
    line: 'rgba(99,211,255,0.95)',
    point: 'rgba(245,165,36,0.95)',
    barFrom: 'rgba(245,165,36,0.95)',
    barTo: 'rgba(99,211,255,0.92)',
  };
}

function pickComparedEvents(topEvents: Array<{ eventName: string; count: number }>, selectedEventName?: string): ComparedEvent[] {
  const preferred = [
    'video_play',
    'vast_impression',
    'vast_quartile_25',
    'vast_quartile_50',
    'vast_quartile_75',
    'vast_complete',
    'video_click',
    'video_cta_click',
    'vast_click',
    'vast_error',
  ];
  const byName = new Map(topEvents.map((item) => [item.eventName, item]));
  const result: ComparedEvent[] = [];

  if (selectedEventName && byName.has(selectedEventName)) {
    result.push(byName.get(selectedEventName)!);
  }

  preferred.forEach((eventName) => {
    const item = byName.get(eventName);
    if (item && !result.some((entry) => entry.eventName === item.eventName)) {
      result.push(item);
    }
  });

  topEvents.forEach((item) => {
    if (!result.some((entry) => entry.eventName === item.eventName)) {
      result.push(item);
    }
  });

  return result.slice(0, 5);
}

function MiniSeriesChart({
  title,
  mode,
  points,
  eventName,
}: {
  title: string;
  mode: 'hour' | 'day';
  points: SeriesPoint[];
  eventName?: string;
}): JSX.Element {
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

  if (points.length === 0) {
    return (
      <div className="field-stack">
        <small className="muted">{title}</small>
        <div className="pill">No trend yet</div>
      </div>
    );
  }

  const visiblePoints = mode === 'hour' ? points.slice(-8) : points.slice(-7);
  const max = Math.max(...visiblePoints.map((point) => point.count), 1);
  const total = visiblePoints.reduce((sum, point) => sum + point.count, 0);
  const latest = visiblePoints[visiblePoints.length - 1];
  const path = buildSparklinePath(visiblePoints, 220, 52);
  const palette = getEventPalette(eventName);

  return (
    <div className="field-stack">
      <div className="meta-line" style={{ justifyContent: 'space-between' }}>
        <small className="muted">{title}</small>
        <span className="pill">{total} events</span>
      </div>

      <div
        style={{
          border: '1px solid rgba(120,144,168,0.2)',
          borderRadius: 16,
          padding: 12,
          background: 'rgba(255,255,255,0.025)',
          position: 'relative',
        }}
        onMouseLeave={() => setHoverPoint(null)}
      >
        {hoverPoint ? (
          <div
            className="pill"
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
              zIndex: 1,
              maxWidth: 220,
              whiteSpace: 'normal',
              borderColor: palette.line,
            }}
          >
            {formatBucket(hoverPoint.bucket, mode)} · {hoverPoint.count}
          </div>
        ) : null}
        <svg viewBox="0 0 220 60" width="100%" height="60" role="img" aria-label={`${title} trend`}>
          <path
            d="M 0 52 H 220"
            stroke="rgba(148,163,184,0.18)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d={path}
            stroke={palette.line}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {visiblePoints.map((point, index) => {
            const x = visiblePoints.length === 1 ? 110 : (index / (visiblePoints.length - 1)) * 220;
            const y = 52 - (point.count / max) * 52;
            return (
              <circle
                key={`${mode}-${point.bucket}`}
                cx={x}
                cy={y}
                r="3.5"
                fill={palette.point}
                onMouseEnter={() => setHoverPoint(point)}
              />
            );
          })}
        </svg>

        <div className="meta-line" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <span className="pill">Peak {max}</span>
          <span className="pill">
            Latest {latest.count} · {formatBucket(latest.bucket, mode)}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${visiblePoints.length}, minmax(0, 1fr))`,
            gap: 6,
            marginTop: 10,
          }}
        >
          {visiblePoints.map((point) => (
            <div
              key={`bar-${mode}-${point.bucket}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <div
                title={`${formatBucket(point.bucket, mode)} · ${point.count}`}
                onMouseEnter={() => setHoverPoint(point)}
                style={{
                  width: '100%',
                  minHeight: 8,
                  height: `${Math.max((point.count / max) * 42, 8)}px`,
                  borderRadius: 999,
                  background: `linear-gradient(180deg, ${palette.barFrom}, ${palette.barTo})`,
                }}
              />
              <span style={{ fontSize: 10, opacity: 0.72, textAlign: 'center' }}>{point.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VideoAnalyticsSection(): JSX.Element {
  const projectId = useStudioStore((state) => state.ui.activeProjectId);
  const widgets = useStudioStore((state) => state.document.widgets);
  const activeSceneId = useStudioStore((state) => state.document.selection.activeSceneId);
  const [events, setEvents] = useState<VideoAnalyticsEventRecord[]>([]);
  const [summary, setSummary] = useState<VideoAnalyticsSummary | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState('');
  const [selectedEventName, setSelectedEventName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoWidgetOptions = useMemo(() => (
    Object.values(widgets)
      .filter((widget) => widget.type === 'interactive-video')
      .map((widget) => ({ id: widget.id, label: widget.name, sceneId: widget.sceneId }))
  ), [widgets]);

  useEffect(() => {
    if (!projectId) {
      setEvents([]);
      setSummary(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      getVideoAnalyticsSummary({
        projectId,
        widgetId: selectedWidgetId || undefined,
        eventName: selectedEventName || undefined,
      }),
      listVideoAnalyticsEvents({
        projectId,
        widgetId: selectedWidgetId || undefined,
        eventName: selectedEventName || undefined,
        limit: 50,
      }),
    ])
      .then(([summaryResult, records]) => {
        if (!cancelled) {
          setSummary(summaryResult);
          setEvents(records);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null);
          setEvents([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, selectedEventName, selectedWidgetId]);

  const eventOptions = useMemo(() => {
    const names = new Set<string>();
    summary?.topEvents.forEach((item) => names.add(item.eventName));
    events.forEach((event) => names.add(event.eventName));
    if (selectedEventName) names.add(selectedEventName);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [events, selectedEventName, summary?.topEvents]);

  const widgetCounts = useMemo(() => (
    (summary?.topWidgets ?? []).map((item) => ({
      widgetId: item.widgetId,
      count: item.count,
      label: widgets[item.widgetId]?.name ?? item.widgetId,
    }))
  ), [summary?.topWidgets, widgets]);

  const currentSceneEvents = useMemo(() => (
    events.filter((event) => event.sceneId === activeSceneId).length
  ), [activeSceneId, events]);

  const comparedEvents = useMemo(
    () => pickComparedEvents(summary?.topEvents ?? [], selectedEventName || undefined),
    [selectedEventName, summary?.topEvents],
  );

  const comparedPeak = useMemo(
    () => Math.max(...comparedEvents.map((item) => item.count), 1),
    [comparedEvents],
  );

  if (!projectId) {
    return <div className="pill">Save or open a cloud project to start reporting video analytics.</div>;
  }

  return (
    <div className="field-stack">
      <div className="meta-line">
        <span className="pill">Events {summary?.totalEvents ?? 0}</span>
        <span className="pill">Current scene {currentSceneEvents}</span>
        <span className="pill">Video widgets {summary?.widgetCount ?? videoWidgetOptions.length}</span>
        <span className="pill">Scenes {summary?.sceneCount ?? 0}</span>
        <span className="pill">Updated {loading ? 'Loading…' : formatDate(summary?.updatedAt)}</span>
      </div>

      <div className="field-stack">
        <label>Filter by interactive video widget</label>
        <select value={selectedWidgetId} onChange={(event) => setSelectedWidgetId(event.target.value)}>
          <option value="">All interactive video widgets</option>
          {videoWidgetOptions.map((widget) => (
            <option key={widget.id} value={widget.id}>
              {widget.label} {widget.sceneId === activeSceneId ? '(current scene)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field-stack">
        <label>Filter by event type</label>
        <select value={selectedEventName} onChange={(event) => setSelectedEventName(event.target.value)}>
          <option value="">All event types</option>
          {eventOptions.map((eventName) => (
            <option key={eventName} value={eventName}>
              {eventName}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
          analytics error · {error}
        </div>
      ) : null}

      <div className="field-stack">
        <small className="muted">Top events</small>
        {(summary?.topEvents.length ?? 0) === 0 ? (
          <div className="pill">No video analytics yet</div>
        ) : summary?.topEvents.slice(0, 8).map(({ eventName, count }) => (
          <div key={eventName} className="pill">
            {eventName} · {count}
          </div>
        ))}
      </div>

      <div className="field-stack">
        <div className="meta-line" style={{ justifyContent: 'space-between' }}>
          <small className="muted">Event comparison</small>
          <span className="pill">{selectedEventName ? `Focused on ${selectedEventName}` : 'Key video events'}</span>
        </div>
        {comparedEvents.length === 0 ? (
          <div className="pill">No comparable events yet</div>
        ) : (
          <div
            style={{
              border: '1px solid rgba(120,144,168,0.2)',
              borderRadius: 16,
              padding: 12,
              background: 'rgba(255,255,255,0.025)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {comparedEvents.map((item) => {
              const palette = getEventPalette(item.eventName);
              const width = `${Math.max((item.count / comparedPeak) * 100, 6)}%`;
              const share = summary?.totalEvents ? Math.round((item.count / summary.totalEvents) * 100) : 0;
              return (
                <div key={`compare-${item.eventName}`} className="field-stack" style={{ gap: 6 }}>
                  <div className="meta-line" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{item.eventName}</span>
                    <span className="pill">{item.count} · {share}%</span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 10,
                      borderRadius: 999,
                      background: 'rgba(148,163,184,0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width,
                        height: '100%',
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${palette.barFrom}, ${palette.barTo})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="field-stack">
        <small className="muted">Top widgets</small>
        {widgetCounts.length === 0 ? (
          <div className="pill">No widget attribution yet</div>
        ) : widgetCounts.slice(0, 6).map((item) => (
          <div key={item.widgetId} className="pill">
            {item.label} · {item.count}
          </div>
        ))}
      </div>

      <MiniSeriesChart
        title="Last 24 hours"
        mode="hour"
        points={summary?.hourlySeries ?? []}
        eventName={selectedEventName || undefined}
      />

      <MiniSeriesChart
        title="Last 14 days"
        mode="day"
        points={summary?.dailySeries ?? []}
        eventName={selectedEventName || undefined}
      />

      <div className="field-stack">
        <small className="muted">Recent stream</small>
        {events.length === 0 ? (
          <div className="pill">Play the interactive video in preview to generate analytics.</div>
        ) : events.slice(0, 12).map((event) => (
          <div key={event.id} className="pill" style={{ display: 'block', whiteSpace: 'normal' }}>
            <strong>{event.eventName}</strong> · {formatDate(event.createdAt)}
            <div style={{ opacity: 0.72, marginTop: 2 }}>
              scene {event.sceneId ?? 'n/a'} · widget {widgets[event.widgetId ?? '']?.name ?? event.widgetId ?? 'n/a'}
            </div>
            {event.metadata && Object.keys(event.metadata).length > 0 ? (
              <div style={{ opacity: 0.72, marginTop: 4, wordBreak: 'break-word' }}>
                {JSON.stringify(event.metadata)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
