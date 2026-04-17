import { appendAuditEventRecord } from '../data/repository.mjs';
import {
  getUserByEmail,
  updateSessionActiveClient,
} from '../data/postgres-auth-repository.mjs';
import {
  getClient,
  listClients,
  upsertClient,
} from '../data/postgres-client-repository.mjs';

export const clientRepository = {
  appendAuditEventRecord,
  getClient,
  getUserByEmail,
  listClients,
  updateSessionActiveClient,
  upsertClient,
};
