import { createHmac } from 'crypto';
import { recordDelivery } from '@smx/db/webhooks';

/**
 * Dispatch a webhook event to its configured URL.
 * Computes an HMAC-SHA256 signature and POSTs the payload.
 * Records the delivery result in the database.
 * Retries are handled by the job queue layer, not here.
 *
 * @param {object} pool         - PostgreSQL connection pool
 * @param {string} webhookId    - ID of the webhook to dispatch
 * @param {string} eventType    - Event type string (e.g. 'tag.impression')
 * @param {object} payload      - Event payload object to serialize as JSON
 * @returns {Promise<object>}   - Delivery record
 */
export async function dispatchWebhook(pool, webhookId, eventType, payload) {
  // Fetch the webhook record (including secret — note: select secret explicitly)
  const { rows } = await pool.query(
    `SELECT id, workspace_id, name, url, secret, events, is_active
     FROM webhooks
     WHERE id = $1`,
    [webhookId],
  );

  const webhook = rows[0];
  if (!webhook) {
    throw new Error(`Webhook ${webhookId} not found`);
  }

  if (!webhook.is_active) {
    // Record as skipped — don't count as an error
    return recordDelivery(pool, webhookId, {
      event_type: eventType,
      payload,
      response_status: null,
      response_body: null,
      duration_ms: 0,
      success: false,
      error_message: 'Webhook is inactive',
      attempts: 1,
    });
  }

  const bodyJson = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);

  // Compute HMAC-SHA256 signature using timestamp + body to prevent replay attacks
  const signaturePayload = `${timestamp}.${bodyJson}`;
  const signature = webhook.secret
    ? createHmac('sha256', webhook.secret).update(signaturePayload).digest('hex')
    : null;

  const headers = {
    'Content-Type': 'application/json',
    'X-SMX-Event': eventType,
    'X-SMX-Delivery': webhookId,
    'X-SMX-Timestamp': String(timestamp),
    'User-Agent': 'SMX-Studio-Webhooks/1.0',
  };

  if (signature) {
    headers['X-SMX-Signature'] = `sha256=${signature}`;
  }

  const startTime = Date.now();
  let responseStatus = null;
  let responseBody = null;
  let success = false;
  let errorMessage = null;

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: bodyJson,
      signal: AbortSignal.timeout(15000), // 15-second timeout
    });

    const durationMs = Date.now() - startTime;
    responseStatus = response.status;

    // Read response body (up to 4KB)
    const rawBody = await response.text().catch(() => '');
    responseBody = rawBody.length > 4096 ? rawBody.slice(0, 4096) + '…' : rawBody;

    success = response.ok; // 2xx

    if (!success) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    return recordDelivery(pool, webhookId, {
      event_type: eventType,
      payload,
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
      success,
      error_message: errorMessage,
      attempts: 1,
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    errorMessage = err.name === 'TimeoutError'
      ? 'Request timed out after 15 seconds'
      : err.message;

    return recordDelivery(pool, webhookId, {
      event_type: eventType,
      payload,
      response_status: null,
      response_body: null,
      duration_ms: durationMs,
      success: false,
      error_message: errorMessage,
      attempts: 1,
    });
  }
}
