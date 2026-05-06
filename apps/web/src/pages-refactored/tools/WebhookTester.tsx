import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Webhook as WebhookIcon,
  Copy,
  CheckCircle2,
  AlertCircle,
} from '../../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  FormField,
  Kicker,
  Badge,
  Tabs,
  TabsList,
  Tab,
  TabPanel,
  EmptyState,
  useToast,
} from '../../system';

type EventType =
  | 'campaign.status_changed'
  | 'campaign.pacing_alert'
  | 'creative.approved'
  | 'creative.rejected'
  | 'discrepancy.detected'
  | 'experiment.completed';

interface DeliveryAttempt {
  id: string;
  url: string;
  event: EventType;
  status: number | null;
  durationMs: number;
  error?: string;
  payload: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timestamp: number;
}

const EVENT_PAYLOADS: Record<EventType, () => Record<string, unknown>> = {
  'campaign.status_changed': () => ({
    event: 'campaign.status_changed',
    workspace_id: 'ws_4f8e2',
    timestamp: new Date().toISOString(),
    data: {
      campaign_id: 'cmp_a3b4c5',
      campaign_name: 'Q4 Brand Awareness',
      previous_status: 'active',
      new_status: 'paused',
      changed_by: 'user@example.com',
    },
  }),
  'campaign.pacing_alert': () => ({
    event: 'campaign.pacing_alert',
    workspace_id: 'ws_4f8e2',
    timestamp: new Date().toISOString(),
    data: {
      campaign_id: 'cmp_a3b4c5',
      campaign_name: 'Holiday Promo',
      pacing_index: 0.71,
      threshold_breached: 'behind_schedule',
      goal_impressions: 1000000,
      delivered_impressions: 712403,
    },
  }),
  'creative.approved': () => ({
    event: 'creative.approved',
    workspace_id: 'ws_4f8e2',
    timestamp: new Date().toISOString(),
    data: {
      creative_id: 'cre_x9y8z7',
      creative_name: '300x250_holiday_v3',
      approved_by: 'admin@example.com',
      campaign_id: 'cmp_a3b4c5',
    },
  }),
  'creative.rejected': () => ({
    event: 'creative.rejected',
    workspace_id: 'ws_4f8e2',
    timestamp: new Date().toISOString(),
    data: {
      creative_id: 'cre_x9y8z7',
      creative_name: '300x250_holiday_v3',
      rejected_by: 'admin@example.com',
      reason: 'Missing brand-safety disclaimer in footer.',
    },
  }),
  'discrepancy.detected': () => ({
    event: 'discrepancy.detected',
    workspace_id: 'ws_4f8e2',
    timestamp: new Date().toISOString(),
    data: {
      campaign_id: 'cmp_a3b4c5',
      metric: 'impressions',
      adserver_value: 124030,
      external_value: 108922,
      variance_pct: 0.139,
      severity: 'high',
    },
  }),
  'experiment.completed': () => ({
    event: 'experiment.completed',
    workspace_id: 'ws_4f8e2',
    timestamp: new Date().toISOString(),
    data: {
      experiment_id: 'exp_q1q2q3',
      experiment_name: 'Headline copy A/B',
      winning_variant: 'B',
      lift_pct: 0.124,
      confidence: 0.97,
      duration_days: 14,
    },
  }),
};

export default function WebhookTester() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [url, setUrl] = useState('https://your-server.example.com/webhooks/dusk');
  const [event, setEvent] = useState<EventType>('campaign.status_changed');
  const [secret, setSecret] = useState('');
  const [history, setHistory] = useState<DeliveryAttempt[]>([]);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'compose' | 'history'>('compose');

  const payload = JSON.stringify(EVENT_PAYLOADS[event](), null, 2);

  const handleSend = async () => {
    if (!url) {
      toast({ tone: 'warning', title: 'Enter a URL first' });
      return;
    }

    setSending(true);
    const attempt: DeliveryAttempt = {
      id: `att_${Date.now()}`,
      url,
      event,
      status: null,
      durationMs: 0,
      payload,
      timestamp: Date.now(),
    };

    const start = performance.now();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Dusk-Webhook-Tester/1.0',
      };
      if (secret) {
        headers['X-Dusk-Signature'] = `t=${Date.now()},v1=stub_for_testing`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
        credentials: 'omit',
        mode: 'cors',
      });

      attempt.status = response.status;
      attempt.durationMs = Math.round(performance.now() - start);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => { responseHeaders[k] = v; });
      attempt.responseHeaders = responseHeaders;

      try {
        attempt.responseBody = await response.text();
      } catch {
        attempt.responseBody = '(could not read response body)';
      }

      if (response.ok) {
        toast({ tone: 'success', title: `${response.status} ${response.statusText}`, description: `Delivered in ${attempt.durationMs}ms` });
      } else {
        toast({ tone: 'warning', title: `${response.status} ${response.statusText}`, description: 'Endpoint returned non-2xx' });
      }
    } catch (error: any) {
      attempt.durationMs = Math.round(performance.now() - start);
      attempt.error = error?.message ?? String(error);
      const errorMessage = attempt.error ?? 'Unknown error';
      toast({
        tone: 'critical',
        title: 'Delivery failed',
        description: errorMessage.includes('fetch')
          ? 'Network or CORS error. The browser cannot reach this URL directly.'
          : errorMessage,
      });
    } finally {
      setHistory((current) => [attempt, ...current].slice(0, 20));
      setSending(false);
      setTab('history');
    }
  };

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      toast({ tone: 'success', title: 'Payload copied' });
    } catch {
      toast({ tone: 'critical', title: 'Could not copy' });
    }
  };

  return (
    <div className="space-y-5 max-w-content mx-auto">
      <header className="dusk-page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" leadingIcon={<ArrowLeft />} onClick={() => navigate('/tools')}>
            Tools
          </Button>
          <div>
            <Kicker>Utilities</Kicker>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
              Webhook tester
            </h1>
            <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
              Fire test payloads at your endpoint and inspect the response.
            </p>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList aria-label="Webhook tester sections">
          <Tab value="compose" leadingIcon={<Send className="h-4 w-4" />}>Compose</Tab>
          <Tab value="history" leadingIcon={<WebhookIcon className="h-4 w-4" />}>
            History
            {history.length > 0 && <Badge tone="neutral" size="sm" className="ml-2">{history.length}</Badge>}
          </Tab>
        </TabsList>

        <TabPanel value="compose">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel padding="lg">
              <PanelHeader title="Endpoint" subtitle="Where to deliver the payload" />
              <div className="space-y-4">
                <FormField label="Endpoint URL" required>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://your-server.example.com/webhooks/dusk"
                    className="dusk-mono"
                  />
                </FormField>

                <FormField label="Event type">
                  <Select
                    value={event}
                    onChange={(e) => setEvent(e.target.value as EventType)}
                    options={[
                      { value: 'campaign.status_changed', label: 'campaign.status_changed' },
                      { value: 'campaign.pacing_alert', label: 'campaign.pacing_alert' },
                      { value: 'creative.approved', label: 'creative.approved' },
                      { value: 'creative.rejected', label: 'creative.rejected' },
                      { value: 'discrepancy.detected', label: 'discrepancy.detected' },
                      { value: 'experiment.completed', label: 'experiment.completed' },
                    ]}
                  />
                </FormField>

                <FormField label="Signing secret" helper="Optional. If set, X-Dusk-Signature header is added.">
                  <Input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="whsec_…"
                    className="dusk-mono"
                  />
                </FormField>

                <Button
                  variant="primary"
                  leadingIcon={<Send />}
                  loading={sending}
                  fullWidth
                  onClick={handleSend}
                >
                  Send test payload
                </Button>
              </div>
            </Panel>

            <Panel padding="lg">
              <PanelHeader
                title="Payload"
                subtitle="Generated for the selected event"
                actions={
                  <Button size="sm" variant="ghost" leadingIcon={<Copy />} onClick={handleCopyPayload}>
                    Copy
                  </Button>
                }
              />
              <pre
                className="
                  rounded-lg p-3 dusk-mono text-xs leading-relaxed
                  bg-[color:var(--dusk-surface-muted)]
                  border border-[color:var(--dusk-border-default)]
                  text-[color:var(--dusk-text-primary)]
                  overflow-x-auto whitespace-pre
                "
                style={{ maxHeight: 320 }}
              >
                {payload}
              </pre>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel value="history">
          {history.length === 0 ? (
            <Panel padding="none">
              <EmptyState
                icon={<WebhookIcon />}
                title="No deliveries yet"
                description="Send a test payload from the Compose tab to see results here."
                action={<Button variant="primary" onClick={() => setTab('compose')}>Compose</Button>}
              />
            </Panel>
          ) : (
            <ul className="space-y-2">
              {history.map((attempt) => (
                <DeliveryRow key={attempt.id} attempt={attempt} />
              ))}
            </ul>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}

function DeliveryRow({ attempt }: { attempt: DeliveryAttempt }) {
  const [expanded, setExpanded] = useState(false);
  const success = attempt.status != null && attempt.status >= 200 && attempt.status < 300;
  const ToneIcon = success ? CheckCircle2 : AlertCircle;
  const tone = success ? 'success' : attempt.error ? 'critical' : 'warning';

  return (
    <li>
      <Panel padding="md">
        <button
          type="button"
          className="w-full flex items-center gap-3 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <ToneIcon
            className="shrink-0 h-5 w-5"
            style={{ color: `var(--dusk-status-${tone}-fg)` }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="dusk-mono text-xs text-[color:var(--dusk-text-primary)] truncate">
                {attempt.event}
              </code>
              {attempt.status != null && (
                <Badge tone={tone as any} size="sm">{attempt.status}</Badge>
              )}
              {attempt.error && (
                <Badge tone="critical" size="sm">network error</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">
              {attempt.url} · {attempt.durationMs}ms · {new Date(attempt.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 pt-3 border-t border-[color:var(--dusk-border-subtle)]">
            <div>
              <Kicker>Request payload</Kicker>
              <pre className="mt-1.5 rounded-lg p-2 dusk-mono text-[10px] bg-[color:var(--dusk-surface-muted)] overflow-x-auto whitespace-pre">
                {attempt.payload}
              </pre>
            </div>
            {attempt.error && (
              <div>
                <Kicker>Error</Kicker>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--dusk-status-critical-fg)' }}>
                  {attempt.error}
                </p>
              </div>
            )}
            {attempt.responseBody && (
              <div>
                <Kicker>Response body</Kicker>
                <pre className="mt-1.5 rounded-lg p-2 dusk-mono text-[10px] bg-[color:var(--dusk-surface-muted)] overflow-x-auto whitespace-pre">
                  {attempt.responseBody.slice(0, 2000)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Panel>
    </li>
  );
}
