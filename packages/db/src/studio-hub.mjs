export async function recordStudioProjectActivity(pool, { workspaceId, projectId, actorUserId = null, action, metadata = {} }) {
  if (!workspaceId || !projectId || !action) return;
  try {
    await pool.query(
      `INSERT INTO studio_project_activity_events (
         workspace_id, project_id, actor_user_id, action, metadata
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [workspaceId, projectId, actorUserId, action, JSON.stringify(metadata ?? {})],
    );
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
              COUNT(*) FILTER (WHERE action = 'opened')::int AS open_count,
              COUNT(*) FILTER (WHERE action IN ('created', 'saved'))::int AS save_count,
              COUNT(*) FILTER (WHERE action = 'version_saved')::int AS version_save_count
       FROM studio_project_activity_events
       WHERE workspace_id = ANY($1::uuid[])
       GROUP BY workspace_id
     )
     SELECT w.id AS workspace_id,
            w.name,
            COALESCE(pc.project_count, 0) AS project_count,
            COALESCE(ac.open_count, 0) AS open_count,
            COALESCE(ac.save_count, 0) AS save_count,
            COALESCE(ac.version_save_count, 0) AS version_save_count
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
            COUNT(*) FILTER (WHERE e.action = 'opened')::int AS open_count
     FROM studio_projects p
     JOIN workspaces w ON w.id = p.workspace_id
     LEFT JOIN users u ON u.id = p.owner_user_id
     LEFT JOIN studio_project_activity_events e
       ON e.project_id = p.id
      AND e.workspace_id = p.workspace_id
     WHERE p.workspace_id = ANY($1::uuid[])
     GROUP BY p.id, w.name, u.display_name
     HAVING COUNT(*) FILTER (WHERE e.action = 'opened') > 0
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

  const { rows: efficiencyRows } = await pool.query(
    `WITH project_activity AS (
       SELECT project_id,
              MIN(created_at) FILTER (WHERE action = 'opened') AS first_open,
              MIN(created_at) FILTER (WHERE action IN ('created', 'saved', 'version_saved')) AS first_save
       FROM studio_project_activity_events
       WHERE workspace_id = ANY($1::uuid[])
       GROUP BY project_id
     ),
     summary AS (
       SELECT
         COUNT(*) FILTER (WHERE action = 'opened')::int AS total_open_events,
         COUNT(*) FILTER (WHERE action IN ('created', 'saved'))::int AS total_save_events,
         COUNT(*) FILTER (WHERE action = 'version_saved')::int AS total_version_save_events
       FROM studio_project_activity_events
       WHERE workspace_id = ANY($1::uuid[])
     )
     SELECT summary.total_open_events,
            summary.total_save_events,
            summary.total_version_save_events,
            ROUND(AVG(EXTRACT(EPOCH FROM (project_activity.first_save - project_activity.first_open)) / 60.0)::numeric, 1) AS average_open_to_save_minutes
     FROM summary
     LEFT JOIN project_activity
       ON project_activity.first_open IS NOT NULL
      AND project_activity.first_save IS NOT NULL
      AND project_activity.first_save >= project_activity.first_open
     GROUP BY summary.total_open_events, summary.total_save_events, summary.total_version_save_events`,
    [workspaceIds],
  );

  const efficiency = efficiencyRows[0] ?? {
    total_open_events: 0,
    total_save_events: 0,
    total_version_save_events: 0,
    average_open_to_save_minutes: null,
  };

  return {
    workspaceMetrics: workspaceMetrics.map((row) => ({
      workspaceId: row.workspace_id,
      name: row.name,
      projectCount: row.project_count,
      openCount: row.open_count,
      saveCount: row.save_count,
      versionSaveCount: row.version_save_count,
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
    efficiency: {
      totalOpenEvents: efficiency.total_open_events ?? 0,
      totalSaveEvents: efficiency.total_save_events ?? 0,
      totalVersionSaveEvents: efficiency.total_version_save_events ?? 0,
      averageOpenToSaveMinutes: efficiency.average_open_to_save_minutes == null ? null : Number(efficiency.average_open_to_save_minutes),
    },
  };
}
