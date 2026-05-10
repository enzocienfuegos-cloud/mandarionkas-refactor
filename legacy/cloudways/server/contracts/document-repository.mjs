import {
  appendAuditEventRecord,
  deleteDocumentSlots,
  listDocumentSlots,
  upsertDocumentSlot,
} from '../data/repository.mjs';

export const documentRepository = {
  appendAuditEventRecord,
  deleteDocumentSlots,
  listDocumentSlots,
  upsertDocumentSlot,
};
