import {
  appendAuditEventRecord,
} from '../data/repository.mjs';
import {
  cleanupExpiredSessionRecords,
  createSessionRecord,
  deleteSessionRecord,
  getSessionRecord,
  getUserByEmail,
  getUserById,
} from '../data/postgres-auth-repository.mjs';
import { listClients } from '../data/postgres-client-repository.mjs';

// Explicit auth-domain contract. Auth services should only depend on this surface.
export const authRepository = {
  appendAuditEventRecord,
  cleanupExpiredSessionRecords,
  createSessionRecord,
  deleteSessionRecord,
  getSessionRecord,
  getUserByEmail,
  getUserById,
  listClients,
};
