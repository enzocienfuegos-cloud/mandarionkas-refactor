import {
  appendAuditEventRecord,
} from '../data/repository.mjs';
import {
  createProjectVersion,
  deleteProjectGraph,
  getProject,
  getProjectState,
  getProjectVersionState,
  listProjects,
  listProjectVersions,
  upsertProject,
} from '../data/postgres-project-repository.mjs';
import { getClient } from '../data/postgres-client-repository.mjs';
import { getUserById } from '../data/postgres-auth-repository.mjs';

// Explicit project-domain contract. Project services should only depend on this surface.
export const projectRepository = {
  appendAuditEventRecord,
  createProjectVersion,
  deleteProjectGraph,
  getClient,
  getProject,
  getProjectState,
  getProjectVersionState,
  getUserById,
  listProjects,
  listProjectVersions,
  upsertProject,
};
