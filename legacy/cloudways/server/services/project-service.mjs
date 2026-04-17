import { randomUUID } from 'node:crypto';
import { projectRepository } from '../contracts/project-repository.mjs';
import { createAuditActor, createAuditEvent } from './audit-service.mjs';
import { assertPermission, canEditProject, canViewProject, nowIso } from './shared.mjs';

function countScenes(state) {
  return Array.isArray(state?.document?.scenes) ? state.document.scenes.length : 0;
}

function countWidgets(state) {
  if (!Array.isArray(state?.document?.scenes)) return 0;
  return state.document.scenes.reduce((count, scene) => count + (scene.widgetIds?.length || 0), 0);
}

async function resolveProjectStateForMutation(sessionRecord, projectId) {
  return (sessionRecord?.db?.projectStates?.[projectId]) ?? (await projectRepository.getProjectState(projectId)) ?? {};
}

function buildAuditInput(sessionRecord, input) {
  return createAuditEvent({
    ...input,
    ...createAuditActor(sessionRecord),
  });
}

function syncProjectInSession(sessionRecord, project, state) {
  if (!sessionRecord?.db) return;
  sessionRecord.db.projects ??= [];
  sessionRecord.db.projectStates ??= {};
  const existingIndex = sessionRecord.db.projects.findIndex((entry) => entry.id === project.id);
  if (existingIndex >= 0) {
    sessionRecord.db.projects[existingIndex] = project;
  } else {
    sessionRecord.db.projects.unshift(project);
  }
  sessionRecord.db.projects.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
  sessionRecord.db.projectStates[project.id] = state;
}

function syncDeletedProjectInSession(sessionRecord, projectId, versions = []) {
  if (!sessionRecord?.db) return;
  sessionRecord.db.projects ??= [];
  sessionRecord.db.projectStates ??= {};
  sessionRecord.db.projectVersions ??= {};
  sessionRecord.db.projectVersionStates ??= {};
  sessionRecord.db.projects = sessionRecord.db.projects.filter((entry) => entry.id !== projectId);
  delete sessionRecord.db.projectStates[projectId];
  delete sessionRecord.db.projectVersions[projectId];
  for (const version of versions) {
    delete sessionRecord.db.projectVersionStates[version.id];
  }
}

function syncProjectVersionInSession(sessionRecord, version, state) {
  if (!sessionRecord?.db) return;
  sessionRecord.db.projectVersions ??= {};
  sessionRecord.db.projectVersionStates ??= {};
  const currentVersions = sessionRecord.db.projectVersions[version.projectId] ?? [];
  sessionRecord.db.projectVersions[version.projectId] = [version, ...currentVersions]
    .filter((entry, index, collection) => collection.findIndex((candidate) => candidate.id === entry.id) === index)
    .sort((left, right) => {
      const leftOrder = typeof left.versionNumber === 'number' ? left.versionNumber : 0;
      const rightOrder = typeof right.versionNumber === 'number' ? right.versionNumber : 0;
      return rightOrder - leftOrder;
    });
  sessionRecord.db.projectVersionStates[version.id] = state;
}

function syncProjectHeaderInSession(sessionRecord, project) {
  if (!sessionRecord?.db) return;
  sessionRecord.db.projects ??= [];
  const existingIndex = sessionRecord.db.projects.findIndex((entry) => entry.id === project.id);
  if (existingIndex >= 0) {
    sessionRecord.db.projects[existingIndex] = project;
    sessionRecord.db.projects.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
  }
}

export async function listProjectsForSession(sessionRecord) {
  assertPermission(sessionRecord, 'projects:view-client');
  const projects = await projectRepository.listProjects();
  return projects.filter((project) => canViewProject(sessionRecord, project));
}

export async function saveProjectForSession(sessionRecord, state, projectId) {
  assertPermission(sessionRecord, 'projects:save');
  const now = nowIso();
  const existing = projectId ? await projectRepository.getProject(projectId) : null;
  if (existing) {
    if (!canEditProject(sessionRecord, existing)) throw new Error('Forbidden: cannot edit project');
    const nextProject = {
      ...existing,
      updatedAt: now,
      name: state?.document?.name || existing.name,
      brandId: state?.document?.metadata?.platform?.brandId,
      brandName: state?.document?.metadata?.platform?.brandName,
      campaignName: state?.document?.metadata?.platform?.campaignName,
      canvasPresetId: state?.document?.canvas?.presetId,
      sceneCount: Array.isArray(state?.document?.scenes) ? countScenes(state) : existing.sceneCount,
      widgetCount: countWidgets(state),
    };
    await projectRepository.upsertProject(nextProject, state);
    syncProjectInSession(sessionRecord, nextProject, state);
    await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
      action: 'project.save',
      target: 'project',
      clientId: nextProject.clientId,
      targetId: nextProject.id,
      summary: `${sessionRecord.user.name} updated project ${nextProject.name}`,
    }));
    return nextProject;
  }

  assertPermission(sessionRecord, 'projects:create');
  const project = {
    id: randomUUID(),
    name: state?.document?.name || `Untitled Project ${(sessionRecord.db?.projects?.length || 0) + 1}`,
    updatedAt: now,
    clientId: sessionRecord.activeClientId,
    ownerUserId: sessionRecord.user.id,
    ownerName: sessionRecord.user.name,
    brandId: state?.document?.metadata?.platform?.brandId,
    brandName: state?.document?.metadata?.platform?.brandName,
    campaignName: state?.document?.metadata?.platform?.campaignName,
    accessScope: state?.document?.metadata?.platform?.accessScope || 'client',
    canvasPresetId: state?.document?.canvas?.presetId,
    sceneCount: Array.isArray(state?.document?.scenes) ? state.document.scenes.length : 1,
    widgetCount: countWidgets(state),
    archivedAt: undefined,
  };
  await projectRepository.upsertProject(project, state);
  syncProjectInSession(sessionRecord, project, state);
  await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'project.create',
    target: 'project',
    clientId: project.clientId,
    targetId: project.id,
    summary: `${sessionRecord.user.name} created project ${project.name}`,
  }));
  return project;
}

export async function loadProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:view-client');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canViewProject(sessionRecord, project)) return null;
  return projectRepository.getProjectState(projectId);
}

export async function deleteProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:delete');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot delete project');
  const versions = await projectRepository.listProjectVersions(projectId);
  await projectRepository.deleteProjectGraph(projectId);
  syncDeletedProjectInSession(sessionRecord, projectId, versions);
  await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'project.delete',
    target: 'project',
    clientId: project.clientId,
    targetId: projectId,
    summary: `${sessionRecord.user.name} deleted project ${project.name}`,
  }));
}

export async function listProjectVersionsForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:view-client');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canViewProject(sessionRecord, project)) return [];
  return projectRepository.listProjectVersions(projectId);
}

export async function saveProjectVersionForSession(sessionRecord, projectId, state, note) {
  assertPermission(sessionRecord, 'projects:save');
  const project = await projectRepository.getProject(projectId);
  if (!project) throw new Error('Project not found');
  if (!canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot version project');
  const versions = await projectRepository.listProjectVersions(projectId);
  const version = {
    id: randomUUID(),
    projectId,
    projectName: project.name,
    versionNumber: versions.length + 1,
    savedAt: nowIso(),
    note,
  };
  const updatedProject = {
    ...project,
    updatedAt: version.savedAt,
  };
  await projectRepository.upsertProject(updatedProject, state);
  await projectRepository.createProjectVersion(version, state);
  syncProjectInSession(sessionRecord, updatedProject, state);
  syncProjectVersionInSession(sessionRecord, version, state);
  await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'project.version.create',
    target: 'project-version',
    clientId: project.clientId,
    targetId: version.id,
    summary: `${sessionRecord.user.name} saved version ${version.versionNumber} of ${project.name}`,
  }));
  return version;
}

export async function loadProjectVersionForSession(sessionRecord, projectId, versionId) {
  assertPermission(sessionRecord, 'projects:view-client');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canViewProject(sessionRecord, project)) return null;
  const versions = await projectRepository.listProjectVersions(projectId);
  if (!versions.some((entry) => entry.id === versionId)) return null;
  return projectRepository.getProjectVersionState(versionId);
}

export async function duplicateProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:view-client');
  assertPermission(sessionRecord, 'projects:create');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canViewProject(sessionRecord, project)) throw new Error('Project not found');
  const state = await projectRepository.getProjectState(projectId);
  if (!state) throw new Error('Project state missing');
  const duplicateId = randomUUID();
  const duplicatedState = JSON.parse(JSON.stringify(state));
  duplicatedState.document = duplicatedState.document || {};
  duplicatedState.document.id = duplicateId;
  duplicatedState.document.name = `${project.name} Copy`;
  duplicatedState.document.metadata = { ...(duplicatedState.document.metadata || {}), dirty: false, lastSavedAt: nowIso() };
  duplicatedState.ui = { ...(duplicatedState.ui || {}), activeProjectId: duplicateId };
  const duplicate = {
    ...project,
    id: duplicateId,
    name: `${project.name} Copy`,
    ownerUserId: sessionRecord.user.id,
    ownerName: sessionRecord.user.name,
    updatedAt: nowIso(),
    archivedAt: undefined,
  };
  await projectRepository.upsertProject(duplicate, duplicatedState);
  syncProjectInSession(sessionRecord, duplicate, duplicatedState);
  await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'project.duplicate',
    target: 'project',
    clientId: duplicate.clientId,
    targetId: duplicate.id,
    summary: `${sessionRecord.user.name} duplicated project ${project.name}`,
    metadata: { sourceProjectId: project.id },
  }));
  return duplicate;
}

export async function archiveProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:delete');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot archive project');
  const nextProject = {
    ...project,
    archivedAt: nowIso(),
    updatedAt: nowIso(),
  };
  const state = await resolveProjectStateForMutation(sessionRecord, projectId);
  await projectRepository.upsertProject(nextProject, state);
  syncProjectHeaderInSession(sessionRecord, nextProject);
  await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'project.archive',
    target: 'project',
    clientId: nextProject.clientId,
    targetId: nextProject.id,
    summary: `${sessionRecord.user.name} archived project ${nextProject.name}`,
  }));
}

export async function restoreProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:delete');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot restore project');
  const nextProject = {
    ...project,
    archivedAt: undefined,
    updatedAt: nowIso(),
  };
  const state = await resolveProjectStateForMutation(sessionRecord, projectId);
  await projectRepository.upsertProject(nextProject, state);
  syncProjectHeaderInSession(sessionRecord, nextProject);
  await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'project.restore',
    target: 'project',
    clientId: nextProject.clientId,
    targetId: nextProject.id,
    summary: `${sessionRecord.user.name} restored project ${nextProject.name}`,
  }));
}

export async function changeProjectOwnerForSession(sessionRecord, projectId, ownerUserId, ownerName) {
  assertPermission(sessionRecord, 'projects:delete');
  const project = await projectRepository.getProject(projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot change owner');
  const client = await projectRepository.getClient(project.clientId);
  if (!client || !client.memberUserIds.includes(ownerUserId)) throw new Error('Forbidden: owner must belong to client');
  const ownerUser = ownerName ? null : await projectRepository.getUserById(ownerUserId);
  const nextProject = {
    ...project,
    ownerUserId,
    ownerName: ownerName || ownerUser?.name || ownerUserId,
    updatedAt: nowIso(),
  };
  const state = await resolveProjectStateForMutation(sessionRecord, projectId);
  await projectRepository.upsertProject(nextProject, state);
  syncProjectHeaderInSession(sessionRecord, nextProject);
  await projectRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'project.owner.change',
    target: 'project',
    clientId: nextProject.clientId,
    targetId: nextProject.id,
    summary: `${sessionRecord.user.name} changed owner of ${nextProject.name} to ${nextProject.ownerName}`,
    metadata: { ownerUserId },
  }));
}
