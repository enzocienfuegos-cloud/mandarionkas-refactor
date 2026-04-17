import { getServerEnv } from '../env.mjs';
import * as postgresRepository from './postgres-repository.mjs';
import * as postgresAuthRepository from './postgres-auth-repository.mjs';
import * as postgresClientRepository from './postgres-client-repository.mjs';
import * as postgresProjectRepository from './postgres-project-repository.mjs';
import * as postgresAssetRepository from './postgres-asset-repository.mjs';

const env = getServerEnv();

export async function listProjects() {
  return postgresProjectRepository.listProjects();
}

export async function getProject(projectId) {
  return postgresProjectRepository.getProject(projectId);
}

export async function getProjectState(projectId) {
  return postgresProjectRepository.getProjectState(projectId);
}

export async function upsertProject(project, state) {
  return postgresProjectRepository.upsertProject(project, state);
}

export async function deleteProjectGraph(projectId) {
  return postgresProjectRepository.deleteProjectGraph(projectId);
}

export async function listProjectVersions(projectId) {
  return postgresProjectRepository.listProjectVersions(projectId);
}

export async function getProjectVersionState(versionId) {
  return postgresProjectRepository.getProjectVersionState(versionId);
}

export async function createProjectVersion(version, state) {
  return postgresProjectRepository.createProjectVersion(version, state);
}

export async function appendAuditEventRecord(event) {
  return postgresRepository.appendAuditEventRecord(event);
}

export async function listUsers() {
  return postgresAuthRepository.listUsers();
}

export async function getUserById(userId) {
  return postgresAuthRepository.getUserById(userId);
}

export async function getUserByEmail(email) {
  return postgresAuthRepository.getUserByEmail(email);
}

export async function listClients() {
  return postgresClientRepository.listClients();
}

export async function getClient(clientId) {
  return postgresClientRepository.getClient(clientId);
}

export async function upsertClient(client) {
  return postgresClientRepository.upsertClient(client);
}

export async function createSessionRecord(sessionId, session) {
  return postgresAuthRepository.createSessionRecord(sessionId, session);
}

export async function getSessionRecord(sessionId) {
  return postgresAuthRepository.getSessionRecord(sessionId);
}

export async function updateSessionActiveClient(sessionId, activeClientId) {
  return postgresAuthRepository.updateSessionActiveClient(sessionId, activeClientId);
}

export async function deleteSessionRecord(sessionId) {
  return postgresAuthRepository.deleteSessionRecord(sessionId);
}

export async function cleanupExpiredSessionRecords(cutoffIso) {
  return postgresAuthRepository.cleanupExpiredSessionRecords(cutoffIso);
}

export async function listAuditEvents(options = {}) {
  return postgresRepository.listAuditEvents(options);
}

export async function upsertDocumentSlot(record) {
  return postgresRepository.upsertDocumentSlot(record);
}

export async function listDocumentSlots(options = {}) {
  return postgresRepository.listDocumentSlots(options);
}

export async function deleteDocumentSlots(options = {}) {
  return postgresRepository.deleteDocumentSlots(options);
}

export async function listAssetFolders() {
  return postgresAssetRepository.listAssetFolders();
}

export async function getAssetFolder(folderId) {
  return postgresAssetRepository.getAssetFolder(folderId);
}

export async function upsertAssetFolder(folder) {
  return postgresAssetRepository.upsertAssetFolder(folder);
}

export async function listAssets() {
  return postgresAssetRepository.listAssets();
}

export async function getAsset(assetId) {
  return postgresAssetRepository.getAsset(assetId);
}

export async function upsertAsset(asset) {
  return postgresAssetRepository.upsertAsset(asset);
}

export async function deleteAssetRecord(assetId) {
  return postgresAssetRepository.deleteAssetRecord(assetId);
}

export function getRepositoryMetadata() {
  const metadata = postgresRepository.getRepositoryMetadata();
  return {
    driver: env.repositoryDriver,
    ...metadata,
  };
}

export async function checkRepositoryReadiness() {
  if (typeof postgresRepository.checkRepositoryReadiness === 'function') {
    return postgresRepository.checkRepositoryReadiness();
  }
  return {
    ok: true,
    driver: env.repositoryDriver,
  };
}
