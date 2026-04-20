import { randomUUID } from 'node:crypto';

export async function recordVideoAnalyticsEvent(client, {
  workspaceId,
  actorUserId = null,
  projectId = null,
  sceneId = null,
  widgetId = null,
  sessionId = null,
  eventName,
  metadata = {},
}) {
  if (!workspaceId || !eventName) {
    throw new Error('workspaceId and eventName are required for video analytics.');
  }

  await client.query(
    `
      insert into video_analytics_events (
        id,
        workspace_id,
        actor_user_id,
        project_id,
        scene_id,
        widget_id,
        event_name,
        session_id,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [
      randomUUID(),
      workspaceId,
      actorUserId,
      projectId,
      sceneId,
      widgetId,
      eventName,
      sessionId,
      JSON.stringify(metadata ?? {}),
    ],
  );
}

export async function listRecentVideoAnalyticsEvents(client, {
  workspaceId,
  projectId = null,
  widgetId = null,
  eventName = null,
  limit = 100,
} = {}) {
  if (!workspaceId) {
    throw new Error('workspaceId is required to list video analytics.');
  }

  const clauses = ['workspace_id = $1'];
  const values = [workspaceId];

  if (projectId) {
    values.push(projectId);
    clauses.push(`project_id = $${values.length}`);
  }

  if (widgetId) {
    values.push(widgetId);
    clauses.push(`widget_id = $${values.length}`);
  }

  if (eventName) {
    values.push(eventName);
    clauses.push(`event_name = $${values.length}`);
  }

  values.push(Math.max(1, Math.min(500, limit)));

  const result = await client.query(
    `
      select
        id,
        workspace_id,
        actor_user_id,
        project_id,
        scene_id,
        widget_id,
        event_name,
        session_id,
        metadata,
        created_at
      from video_analytics_events
      where ${clauses.join(' and ')}
      order by created_at desc
      limit $${values.length}
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    actorUserId: row.actor_user_id || undefined,
    projectId: row.project_id || undefined,
    sceneId: row.scene_id || undefined,
    widgetId: row.widget_id || undefined,
    eventName: row.event_name,
    sessionId: row.session_id || undefined,
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getVideoAnalyticsSummary(client, {
  workspaceId,
  projectId = null,
  widgetId = null,
  sceneId = null,
  eventName = null,
} = {}) {
  if (!workspaceId) {
    throw new Error('workspaceId is required to summarize video analytics.');
  }

  const clauses = ['workspace_id = $1'];
  const values = [workspaceId];

  if (projectId) {
    values.push(projectId);
    clauses.push(`project_id = $${values.length}`);
  }

  if (widgetId) {
    values.push(widgetId);
    clauses.push(`widget_id = $${values.length}`);
  }

  if (sceneId) {
    values.push(sceneId);
    clauses.push(`scene_id = $${values.length}`);
  }

  if (eventName) {
    values.push(eventName);
    clauses.push(`event_name = $${values.length}`);
  }

  const whereSql = clauses.join(' and ');

  const [totalsResult, topEventsResult, topWidgetsResult, lastEventResult, hourlySeriesResult, dailySeriesResult] = await Promise.all([
    client.query(
      `
        select
          count(*)::int as total_events,
          count(distinct coalesce(widget_id, ''))::int as widget_count,
          count(distinct coalesce(scene_id, ''))::int as scene_count
        from video_analytics_events
        where ${whereSql}
      `,
      values,
    ),
    client.query(
      `
        select event_name, count(*)::int as count
        from video_analytics_events
        where ${whereSql}
        group by event_name
        order by count desc, event_name asc
        limit 10
      `,
      values,
    ),
    client.query(
      `
        select widget_id, count(*)::int as count
        from video_analytics_events
        where ${whereSql} and widget_id is not null
        group by widget_id
        order by count desc, widget_id asc
        limit 10
      `,
      values,
    ),
    client.query(
      `
        select created_at
        from video_analytics_events
        where ${whereSql}
        order by created_at desc
        limit 1
      `,
      values,
    ),
    client.query(
      `
        select
          to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:00:00"Z"') as bucket,
          count(*)::int as count
        from video_analytics_events
        where ${whereSql}
          and created_at >= now() - interval '24 hours'
        group by date_trunc('hour', created_at)
        order by date_trunc('hour', created_at) asc
      `,
      values,
    ),
    client.query(
      `
        select
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD"T"00:00:00"Z"') as bucket,
          count(*)::int as count
        from video_analytics_events
        where ${whereSql}
          and created_at >= now() - interval '14 days'
        group by date_trunc('day', created_at)
        order by date_trunc('day', created_at) asc
      `,
      values,
    ),
  ]);

  const totals = totalsResult.rows[0] ?? { total_events: 0, widget_count: 0, scene_count: 0 };

  return {
    totalEvents: totals.total_events ?? 0,
    widgetCount: totals.widget_count ?? 0,
    sceneCount: totals.scene_count ?? 0,
    updatedAt: lastEventResult.rows[0]?.created_at?.toISOString(),
    topEvents: topEventsResult.rows.map((row) => ({
      eventName: row.event_name,
      count: row.count,
    })),
    topWidgets: topWidgetsResult.rows.map((row) => ({
      widgetId: row.widget_id,
      count: row.count,
    })),
    hourlySeries: hourlySeriesResult.rows.map((row) => ({
      bucket: row.bucket,
      count: row.count,
    })),
    dailySeries: dailySeriesResult.rows.map((row) => ({
      bucket: row.bucket,
      count: row.count,
    })),
  };
}
