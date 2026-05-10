import { useCallback, useEffect, useState } from 'react';

export interface WebhookRecord {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  secret?: string;
  createdAt: string;
}

export interface DeliveryRecord {
  id: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  sentAt: string;
  responseTime?: number;
}

export function useWebhookData() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch('/v1/webhooks', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Couldn’t load webhook endpoints. Check workspace access or try again in a moment.');
        return response.json();
      })
      .then((payload) => setWebhooks(payload?.webhooks ?? payload ?? []))
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadDeliveries = useCallback((webhookId: string) => {
    setLoadingDeliveries(true);
    setSelectedWebhookId(webhookId);
    fetch(`/v1/webhooks/${webhookId}/deliveries`, { credentials: 'include' })
      .then((response) => response.json())
      .then((payload) => setDeliveries(payload?.deliveries ?? payload ?? []))
      .catch(() => setDeliveries([]))
      .finally(() => setLoadingDeliveries(false));
  }, []);

  return {
    webhooks,
    setWebhooks,
    loading,
    error,
    selectedWebhookId,
    setSelectedWebhookId,
    deliveries,
    setDeliveries,
    loadingDeliveries,
    load,
    loadDeliveries,
  };
}

function generateSecret(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function useWebhookForm() {
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookRecord | null>(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    events: new Set<string>(),
    secret: '',
    status: 'active' as WebhookRecord['status'],
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const openNewModal = useCallback(() => {
    setEditingWebhook(null);
    setForm({ name: '', url: '', events: new Set(), secret: generateSecret(), status: 'active' });
    setFormError('');
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((webhook: WebhookRecord) => {
    setEditingWebhook(webhook);
    setForm({
      name: webhook.name,
      url: webhook.url,
      events: new Set(webhook.events),
      secret: webhook.secret ?? '',
      status: webhook.status,
    });
    setFormError('');
    setShowModal(true);
  }, []);

  const toggleEvent = useCallback((eventName: string) => {
    setForm((current) => {
      const nextEvents = new Set(current.events);
      nextEvents.has(eventName) ? nextEvents.delete(eventName) : nextEvents.add(eventName);
      return { ...current, events: nextEvents };
    });
  }, []);

  return {
    showModal,
    setShowModal,
    editingWebhook,
    form,
    setForm,
    creating,
    setCreating,
    formError,
    setFormError,
    openNewModal,
    openEditModal,
    toggleEvent,
    generateSecret,
  };
}
