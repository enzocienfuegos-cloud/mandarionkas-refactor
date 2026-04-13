import { fetchOptionalJson } from '../../shared/net/http-json';

type SubmitPayload = {
  url: string;
  method: string;
  fields: Record<string, string>;
  widgetId: string;
  widgetName: string;
};

export async function submitFormWebhook({ url, method, fields, widgetId, widgetName }: SubmitPayload): Promise<void> {
  await fetchOptionalJson<unknown>(url, {
    method,
    body: JSON.stringify({ fields, widgetId, widgetName }),
  });
}
