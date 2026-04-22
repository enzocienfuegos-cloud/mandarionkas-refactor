function metricsPatchForAction(action) {
  switch (action) {
    case 'opened':
      return { opens: 1 };
    case 'created':
    case 'saved':
      return { saves: 1 };
    case 'version_saved':
      return { versionSaves: 1 };
    case 'exported':
      return { exports: 1 };
    case 'shared':
      return { shares: 1 };
    case 'duplicated':
      return { duplicates: 1 };
    case 'archived':
      return { archives: 1 };
    case 'restored':
      return { restores: 1 };
    case 'deleted':
      return { deletes: 1 };
    case 'owner_changed':
      return { ownerChanges: 1 };
    default:
      return null;
  }
}

export async function bumpStudioProjectMetricDay(pool, { workspaceId, projectId, actorUserId = null, action, createdAt = null }) {
  const patch = metricsPatchForAction(action);
  if (!workspaceId || !projectId || !actorUserId || !patch) return;
  const metricDate = createdAt ? new Date(createdAt) : new Date();
  const metricDateIso = Number.isNaN(metricDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : metricDate.toISOString().slice(0, 10);

  try {
    await pool.query(
      `INSERT INTO studio_project_metrics_daily (
         metric_date, workspace_id, project_id, actor_user_id,
         opens_count, saves_count, version_saves_count,
         export_count, share_count,
         duplicate_count, archive_count, restore_count,
         delete_count, owner_change_count
       ) VALUES (
         $1::date, $2, $3, $4,
         $5, $6, $7,
         $8, $9,
         $10, $11, $12,
         $13, $14
       )
       ON CONFLICT (metric_date, workspace_id, project_id, actor_user_id)
       DO UPDATE SET
         opens_count = studio_project_metrics_daily.opens_count + EXCLUDED.opens_count,
         saves_count = studio_project_metrics_daily.saves_count + EXCLUDED.saves_count,
         version_saves_count = studio_project_metrics_daily.version_saves_count + EXCLUDED.version_saves_count,
         export_count = studio_project_metrics_daily.export_count + EXCLUDED.export_count,
         share_count = studio_project_metrics_daily.share_count + EXCLUDED.share_count,
         duplicate_count = studio_project_metrics_daily.duplicate_count + EXCLUDED.duplicate_count,
         archive_count = studio_project_metrics_daily.archive_count + EXCLUDED.archive_count,
         restore_count = studio_project_metrics_daily.restore_count + EXCLUDED.restore_count,
         delete_count = studio_project_metrics_daily.delete_count + EXCLUDED.delete_count,
         owner_change_count = studio_project_metrics_daily.owner_change_count + EXCLUDED.owner_change_count`,
      [
        metricDateIso,
        workspaceId,
        projectId,
        actorUserId,
        patch.opens ?? 0,
        patch.saves ?? 0,
        patch.versionSaves ?? 0,
        patch.exports ?? 0,
        patch.shares ?? 0,
        patch.duplicates ?? 0,
        patch.archives ?? 0,
        patch.restores ?? 0,
        patch.deletes ?? 0,
        patch.ownerChanges ?? 0,
      ],
    );
  } catch {
    // metric materialization must not break request flow
  }
}

export async function recordStudioProjectActivity(pool, { workspaceId, projectId, actorUserId = null, action, metadata = {} }) {
  if (!workspaceId || !projectId || !action) return;
  try {
    const result = await pool.query(
      `INSERT INTO studio_project_activity_events (
         workspace_id, project_id, actor_user_id, action, metadata
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [workspaceId, projectId, actorUserId, action, JSON.stringify(metadata ?? {})],
    );
    await bumpStudioProjectMetricDay(pool, {
      workspaceId,
      projectId,
      actorUserId,
      action,
      createdAt: result.rows?.[0]?.created_at ?? null,
    });
  } catch {
    // activity logging must never break primary request flow
  }
}

export async function listAccessibleStudioWorkspaces(pool, userId) {
  const { rows } = await pool.query(
    `SELECT w.id, w.name, w.slug
     FROM workspaces w
     JOIN workspace_members wm
       ON wm.workspace_id = w.id
      AND wm.user_id = $1
      AND wm.status = 'active'
     ORDER BY w.name ASC`,
    [userId],
  );
  return rows;
}

export async function getStudioHubOverview(pool, userId) {
  const workspaces = await listAccessibleStudioWorkspaces(pool, userId);
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  if (!workspaceIds.length) {
    return {
      workspaceMetrics: [],
      topProjects: [],
      recentActivity: [],
      contributorLeaderboard: [],
      clientLeaderboard: [],
      efficiency: {
        totalOpenEvents: 0,
        totalSaveEvents: 0,
        totalVersionSaveEvents: 0,
        averageOpenToSaveMinutes: null,
      },
    };
  }

  const { rows: workspaceMetrics } = await pool.query(
    `WITH project_counts AS (
       SELECT workspace_id, COUNT(*)::int AS project_count
       FROM studio_projects
       WHERE workspace_id = ANY($1::uuid[])
       GROUP BY workspace_id
     ),
     activity_counts AS (
       SELECT workspace_id,
             SUM(opens_count)::int AS open_count,
             SUM(saves_count)::int AS save_count,
             SUM(version_saves_count)::int AS version_save_count,
             SUM(export_count)::int AS export_count,
             SUM(share_count)::int AS share_count
       FROM studio_project_metrics_daily
       WHERE workspace_id = ANY($1::uuid[])
       GROUP BY workspace_id
     )
     SELECT w.id AS workspace_id,
            w.name,
            COALESCE(pc.project_count, 0) AS project_count,
            COALESCE(ac.open_count, 0) AS open_count,
            COALESCE(ac.save_count, 0) AS save_count,
            COALESCE(ac.version_save_count, 0) AS version_save_count,
            COALESCE(ac.export_count, 0) AS export_count,
            COALESCE(ac.share_count, 0) AS share_count
     FROM workspaces w
     LEFT JOIN project_counts pc ON pc.workspace_id = w.id
     LEFT JOIN activity_counts ac ON ac.workspace_id = w.id
     WHERE w.id = ANY($1::uuid[])
     ORDER BY w.name ASC`,
    [workspaceIds],
  );

  const { rows: topProjects } = await pool.query(
    `SELECT p.id,
            p.workspace_id,
            w.name AS workspace_name,
            p.name,
            p.brand_name,
            p.campaign_name,
            p.owner_user_id,
            u.display_name AS owner_name,
            p.updated_at,
            p.archived_at,
            p.canvas_preset_id,
            p.scene_count,
            p.widget_count,
            COALESCE(SUM(m.opens_count), 0)::int AS open_count
     FROM studio_projects p
     JOIN workspaces w ON w.id = p.workspace_id
     LEFT JOIN users u ON u.id = p.owner_user_id
     LEFT JOIN studio_project_metrics_daily m
       ON m.project_id = p.id
      AND m.workspace_id = p.workspace_id
     WHERE p.workspace_id = ANY($1::uuid[])
     GROUP BY p.id, w.name, u.display_name
     HAVING COALESCE(SUM(m.opens_count), 0) > 0
     ORDER BY open_count DESC, p.updated_at DESC
     LIMIT 8`,
    [workspaceIds],
  );

  const { rows: recentActivity } = await pool.query(
    `SELECT e.id,
            e.workspace_id,
            w.name AS workspace_name,
            e.project_id,
            p.name AS project_name,
            e.actor_user_id,
            u.display_name AS actor_name,
            e.action,
            e.created_at
     FROM studio_project_activity_events e
     JOIN workspaces w ON w.id = e.workspace_id
     JOIN studio_projects p ON p.id = e.project_id
     LEFT JOIN users u ON u.id = e.actor_user_id
     WHERE e.workspace_id = ANY($1::uuid[])
     ORDER BY e.created_at DESC
     LIMIT 16`,
    [workspaceIds],
  );

  const { rows: contributorLeaderboard } = await pool.query(
    `SELECT m.actor_user_id,
            u.display_name AS actor_name,
            COUNT(DISTINCT m.project_id)::int AS project_count,
            COALESCE(SUM(m.opens_count), 0)::int AS open_count,
            COALESCE(SUM(m.saves_count), 0)::int AS save_count,
            COALESCE(SUM(m.version_saves_count), 0)::int AS version_save_count,
            COALESCE(SUM(m.export_count), 0)::int AS export_count,
            COALESCE(SUM(m.share_count), 0)::int AS share_count
     FROM studio_project_metrics_daily m
     LEFT JOIN users u ON u.id = m.actor_user_id
     WHERE m.workspace_id = ANY($1::uuid[])
     GROUP BY m.actor_user_id, u.display_name
     ORDER BY export_count DESC, version_save_count DESC, save_count DESC, open_count DESC
     LIMIT 8`,
    [workspaceIds],
  );

  const { rows: clientLeaderboard } = await pool.query(
    `SELECT w.id AS workspace_id,
            w.name AS workspace_name,
            COUNT(DISTINCT m.project_id)::int AS project_count,
            COALESCE(SUM(m.opens_count), 0)::int AS open_count,
            COALESCE(SUM(m.saves_count), 0)::int AS save_count,
            COALESCE(SUM(m.version_saves_count), 0)::int AS version_save_count,
            COALESCE(SUM(m.export_count), 0)::int AS export_count,
            COALESCE(SUM(m.share_count), 0)::int AS share_count
     FROM studio_project_metrics_daily m
     JOIN workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = ANY($1::uuid[])
     GROUP BY w.id, w.name
     ORDER BY export_count DESC, version_save_count DESC, save_count DESC, open_count DESC
     LIMIT 8`,
    [workspaceIds],
  );

  const { rows: efficiencyRows } = await pool.query(
    `WITH project_activity AS (
       SELECT project_id,
              MIN(created_at) FILTER (WHERE action = 'opened') AS first_open,
              MIN(created_at) FILTER (WHERE action IN ('created', 'saved', 'version_saved')) AS first_save,
              MIN(created_at) FILTER (WHERE action = 'exported') AS first_export
       FROM studio_project_activity_events
       WHERE workspace_id = ANY($1::uuid[])
       GROUP BY project_id
     ),
     summary AS (
       SELECT
         COALESCE(SUM(opens_count), 0)::int AS total_open_events,
         COALESCE(SUM(saves_count), 0)::int AS total_save_events,
         COALESCE(SUM(version_saves_count), 0)::int AS total_version_save_events,
         COALESCE(SUM(export_count), 0)::int AS total_export_events,
         COALESCE(SUM(share_count), 0)::int AS total_share_events
       FROM studio_project_metrics_daily
       WHERE workspace_id = ANY($1::uuid[])
     )
     SELECT summary.total_open_events,
            summary.total_save_events,
            summary.total_version_save_events,
            summary.total_export_events,
            summary.total_share_events,
            ROUND(AVG(EXTRACT(EPOCH FROM (project_activity.first_save - project_activity.first_open)) / 60.0)::numeric, 1) AS average_open_to_save_minutes,
            ROUND(AVG(EXTRACT(EPOCH FROM (project_activity.first_export - project_activity.first_open)) / 60.0)::numeric, 1) AS average_open_to_export_minutes
     FROM summary
     LEFT JOIN project_activity
       ON project_activity.first_open IS NOT NULL
     GROUP BY
       summary.total_open_events,
       summary.total_save_events,
       summary.total_version_save_events,
       summary.total_export_events,
       summary.total_share_events`,
    [workspaceIds],
  );

  const efficiency = efficiencyRows[0] ?? {
    total_open_events: 0,
    total_save_events: 0,
    total_version_save_events: 0,
    total_export_events: 0,
    total_share_events: 0,
    average_open_to_save_minutes: null,
    average_open_to_export_minutes: null,
  };

  return {
    workspaceMetrics: workspaceMetrics.map((row) => ({
      workspaceId: row.workspace_id,
      name: row.name,
      projectCount: row.project_count,
      openCount: row.open_count,
      saveCount: row.save_count,
      versionSaveCount: row.version_save_count,
      exportCount: row.export_count,
      shareCount: row.share_count,
    })),
    topProjects: topProjects.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      name: row.name,
      brandName: row.brand_name ?? undefined,
      campaignName: row.campaign_name ?? undefined,
      ownerUserId: row.owner_user_id,
      ownerName: row.owner_name ?? undefined,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
      archivedAt: row.archived_at ? (row.archived_at instanceof Date ? row.archived_at.toISOString() : new Date(row.archived_at).toISOString()) : undefined,
      canvasPresetId: row.canvas_preset_id ?? undefined,
      sceneCount: row.scene_count ?? 0,
      widgetCount: row.widget_count ?? 0,
      openCount: row.open_count ?? 0,
    })),
    recentActivity: recentActivity.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      projectId: row.project_id,
      projectName: row.project_name,
      actorUserId: row.actor_user_id ?? null,
      actorName: row.actor_name ?? null,
      action: row.action,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    })),
    contributorLeaderboard: contributorLeaderboard.map((row) => ({
      actorUserId: row.actor_user_id,
      actorName: row.actor_name ?? row.actor_user_id,
      projectCount: row.project_count ?? 0,
      openCount: row.open_count ?? 0,
      saveCount: row.save_count ?? 0,
      versionSaveCount: row.version_save_count ?? 0,
      exportCount: row.export_count ?? 0,
      shareCount: row.share_count ?? 0,
    })),
    clientLeaderboard: clientLeaderboard.map((row) => ({
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      projectCount: row.project_count ?? 0,
      openCount: row.open_count ?? 0,
      saveCount: row.save_count ?? 0,
      versionSaveCount: row.version_save_count ?? 0,
      exportCount: row.export_count ?? 0,
      shareCount: row.share_count ?? 0,
    })),
    efficiency: {
      totalOpenEvents: efficiency.total_open_events ?? 0,
      totalSaveEvents: efficiency.total_save_events ?? 0,
      totalVersionSaveEvents: efficiency.total_version_save_events ?? 0,
      totalExportEvents: efficiency.total_export_events ?? 0,
      totalShareEvents: efficiency.total_share_events ?? 0,
      averageOpenToSaveMinutes: efficiency.average_open_to_save_minutes == null ? null : Number(efficiency.average_open_to_save_minutes),
      averageOpenToExportMinutes: efficiency.average_open_to_export_minutes == null ? null : Number(efficiency.average_open_to_export_minutes),
    },
  };
}
