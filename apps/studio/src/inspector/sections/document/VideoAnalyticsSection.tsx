import { useEffect, useMemo, useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { getCapability } from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import {
  getVideoAnalyticsSummary,
  listVideoAnalyticsEvents,
  type VideoAnalyticsEventRecord,
  type VideoAnalyticsSummary,
} from '../../../repositories/video-analytics/api';
import {
  analyticsMetadataStyle,
  buildAnalyticsCompareFillStyle,
  formatDate,
  getEventPalette,
  MiniSeriesChart,
  pickComparedEvents,
} from './VideoAnalyticsSection.charts';

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
      .filter((widget) => getCapability(getWidgetDefinition(widget.type), 'hasVideoAnalytics'))
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
        <div className="pill pill--danger">
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
        <div className="meta-line meta-line--between">
          <small className="muted">Event comparison</small>
          <span className="pill">{selectedEventName ? `Focused on ${selectedEventName}` : 'Key video events'}</span>
        </div>
        {comparedEvents.length === 0 ? (
          <div className="pill">No comparable events yet</div>
        ) : (
          <div className="analytics-compare-card">
            {comparedEvents.map((item) => {
              const palette = getEventPalette(item.eventName);
              const width = `${Math.max((item.count / comparedPeak) * 100, 6)}%`;
              const share = summary?.totalEvents ? Math.round((item.count / summary.totalEvents) * 100) : 0;
              return (
                <div key={`compare-${item.eventName}`} className="field-stack analytics-compare-item">
                  <div className="meta-line analytics-compare-head">
                    <span className="analytics-compare-label">{item.eventName}</span>
                    <span className="pill">{item.count} · {share}%</span>
                  </div>
                  <div className="analytics-compare-track">
                    <div
                      className="analytics-compare-fill"
                      style={buildAnalyticsCompareFillStyle(
                        width,
                        `linear-gradient(90deg, ${palette.barFrom}, ${palette.barTo})`,
                      )}
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
          <div key={event.id} className="pill analytics-stream-pill">
            <strong>{event.eventName}</strong> · {formatDate(event.createdAt)}
            <div className="content-caption-block content-caption-block--muted content-caption-block--spaced-sm">
              scene {event.sceneId ?? 'n/a'} · widget {widgets[event.widgetId ?? '']?.name ?? event.widgetId ?? 'n/a'}
            </div>
            {event.metadata && Object.keys(event.metadata).length > 0 ? (
              <div className="content-caption-block content-caption-block--muted content-caption-block--spaced-md" style={analyticsMetadataStyle}>
                {JSON.stringify(event.metadata)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
