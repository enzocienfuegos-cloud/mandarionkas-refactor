import { badRequest, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import {
  createWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  listWebhooks,
  updateWebhook,
} from '@smx/db/src/webhooks.mjs';
import { withSession } from '../../../lib/session.mjs';

function getWorkspaceId(session) {
  return session.session.activeWorkspaceId || session.workspaces[0]?.id || null;
}

export async function handleWebhookRoutes(ctx) {
  const { method, pathname, requestId, res, body } = ctx;

  if (method === 'GET' && pathname === '/v1/webhooks') {
    return withSession(ctx, async (session) => {
      const webhooks = await listWebhooks(session.client, getWorkspaceId(session));
      return sendJson(res, 200, { webhooks, requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/webhooks') {
    return withSession(ctx, async (session) => {
      if (!body || typeof body !== 'object') return badRequest(res, requestId, 'Webhook payload is required.');
      const webhook = await createWebhook(session.client, getWorkspaceId(session), session.user.id, body);
      return sendJson(res, 201, webhook);
    });
  }

  if (method === 'GET' && /\/v1\/webhooks\/[^/]+\/deliveries$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const webhookId = pathname.split('/')[3];
      const deliveries = await listWebhookDeliveries(session.client, getWorkspaceId(session), webhookId);
      return sendJson(res, 200, { deliveries, requestId });
    });
  }

  if (method === 'PUT' && /\/v1\/webhooks\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!body || typeof body !== 'object') return badRequest(res, requestId, 'Webhook payload is required.');
      const webhookId = pathname.split('/')[3];
      const webhook = await updateWebhook(session.client, getWorkspaceId(session), webhookId, body);
      return sendJson(res, 200, webhook);
    });
  }

  if (method === 'DELETE' && /\/v1\/webhooks\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const webhookId = pathname.split('/')[3];
      await deleteWebhook(session.client, getWorkspaceId(session), webhookId);
      return sendJson(res, 200, { ok: true, requestId });
    });
  }

  return false;
}
