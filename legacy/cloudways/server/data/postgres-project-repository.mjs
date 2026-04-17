import { executePostgresQuery, withPostgresTransaction } from './postgres-client.mjs';
import { parseJson, table } from './postgres-support.mjs';
import {
  toDomainProject,
  toDomainProjectVersion,
  toProjectStateUpsertParams,
  toProjectUpsertParams,
  toProjectVersionInsertParams,
  toProjectVersionStateInsertParams,
} from './mappers/project-mapper.mjs';

export async function listProjects() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('projects')} ORDER BY updated_at DESC NULLS LAST, id ASC`);
  return (result.rows ?? []).map(toDomainProject);
}

export async function getProject(projectId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('projects')} WHERE id = $1 LIMIT 1`, [projectId]);
  const row = result.rows?.[0];
  return row ? toDomainProject(row) : null;
}

export async function getProjectState(projectId) {
  const result = await executePostgresQuery(`SELECT state FROM ${table('project_states')} WHERE project_id = $1 LIMIT 1`, [projectId]);
  return parseJson(result.rows?.[0]?.state, null);
}

export async function upsertProject(project, state) {
  await withPostgresTransaction(async (query) => {
    await query(
      `INSERT INTO ${table('projects')} (
        id, name, updated_at, client_id, owner_user_id, owner_name, brand_id, brand_name, campaign_name,
        access_scope, canvas_preset_id, scene_count, widget_count, archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = EXCLUDED.updated_at,
        client_id = EXCLUDED.client_id,
        owner_user_id = EXCLUDED.owner_user_id,
        owner_name = EXCLUDED.owner_name,
        brand_id = EXCLUDED.brand_id,
        brand_name = EXCLUDED.brand_name,
        campaign_name = EXCLUDED.campaign_name,
        access_scope = EXCLUDED.access_scope,
        canvas_preset_id = EXCLUDED.canvas_preset_id,
        scene_count = EXCLUDED.scene_count,
        widget_count = EXCLUDED.widget_count,
        archived_at = EXCLUDED.archived_at`,
      toProjectUpsertParams(project)
    );
    await query(
      `INSERT INTO ${table('project_states')} (project_id, state)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (project_id) DO UPDATE SET state = EXCLUDED.state`,
      toProjectStateUpsertParams(project.id, state)
    );
  });
  return project;
}

export async function deleteProjectGraph(projectId) {
  await executePostgresQuery(`DELETE FROM ${table('projects')} WHERE id = $1`, [projectId]);
}

export async function listProjectVersions(projectId) {
  const result = await executePostgresQuery(
    `SELECT * FROM ${table('project_versions')}
     WHERE project_id = $1
     ORDER BY version_number DESC, saved_at DESC NULLS LAST, id DESC`,
    [projectId]
  );
  return (result.rows ?? []).map(toDomainProjectVersion);
}

export async function getProjectVersionState(versionId) {
  const result = await executePostgresQuery(
    `SELECT state FROM ${table('project_version_states')} WHERE version_id = $1 LIMIT 1`,
    [versionId]
  );
  return parseJson(result.rows?.[0]?.state, null);
}

export async function createProjectVersion(version, state) {
  await withPostgresTransaction(async (query) => {
    await query(
      `INSERT INTO ${table('project_versions')} (
        id, project_id, project_name, version_number, saved_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      toProjectVersionInsertParams(version)
    );
    await query(
      `INSERT INTO ${table('project_version_states')} (version_id, state)
       VALUES ($1, $2::jsonb)`,
      toProjectVersionStateInsertParams(version.id, state)
    );
  });
  return version;
}
