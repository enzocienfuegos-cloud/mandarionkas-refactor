import { useEffect, useMemo, useState } from 'react';
import { readStorageItem, writeStorageItem } from '../../shared/browser/storage';
import type { ClientPreviewComment, ClientPreviewPin, ClientPreviewThread } from './types';

const AUTHOR_NAME = 'Client Review';

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CR';
}

function colorFromName(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 52%)`;
}

function storageKey(projectId: string): string {
  return `smx:client-preview:threads:${projectId}`;
}

function readThreads(projectId: string): ClientPreviewThread[] {
  const raw = readStorageItem(storageKey(projectId), '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ClientPreviewThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeThreads(projectId: string, threads: ClientPreviewThread[]): void {
  writeStorageItem(storageKey(projectId), JSON.stringify(threads));
}

export function formatRelativeTime(value: string): string {
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return `${Math.max(1, Math.abs(diffMinutes))}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `${Math.max(1, Math.abs(diffHours))}h`;
  const diffDays = Math.round(diffHours / 24);
  return `${Math.max(1, Math.abs(diffDays))}d`;
}

export function useClientPreview(projectId: string, sceneIndex: number) {
  const [threads, setThreads] = useState<ClientPreviewThread[]>(() => readThreads(projectId));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState(false);

  useEffect(() => {
    setThreads(readThreads(projectId));
  }, [projectId]);

  useEffect(() => {
    writeThreads(projectId, threads);
  }, [projectId, threads]);

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !thread.resolvedAt && (!thread.pin || thread.pin.sceneIndex === sceneIndex)),
    [sceneIndex, threads],
  );

  const createComment = (threadId: string, body: string, parentId?: string): ClientPreviewComment => ({
    id: createId('comment'),
    threadId,
    pinId: threads.find((thread) => thread.id === threadId)?.pin?.id,
    authorName: AUTHOR_NAME,
    authorInitials: getInitials(AUTHOR_NAME),
    authorColor: colorFromName(AUTHOR_NAME),
    body,
    createdAt: new Date().toISOString(),
    parentId,
  });

  function addComment(body: string): void {
    const trimmed = body.trim();
    if (!trimmed) return;

    if (replyThreadId) {
      setThreads((current) => current.map((thread) => thread.id === replyThreadId
        ? { ...thread, comments: [...thread.comments, createComment(replyThreadId, trimmed, replyParentId ?? undefined)] }
        : thread));
      setActiveThreadId(replyThreadId);
      setReplyThreadId(null);
      setReplyParentId(null);
      return;
    }

    const nextThreadId = activeThreadId && threads.some((thread) => thread.id === activeThreadId)
      ? activeThreadId
      : createId('thread');

    setThreads((current) => {
      const existing = current.find((thread) => thread.id === nextThreadId);
      if (existing) {
        return current.map((thread) => thread.id === nextThreadId
          ? { ...thread, comments: [...thread.comments, createComment(nextThreadId, trimmed)] }
          : thread);
      }
      return [{
        id: nextThreadId,
        comments: [createComment(nextThreadId, trimmed)],
      }, ...current];
    });
    setActiveThreadId(nextThreadId);
  }

  function addPinnedThread(pin: Omit<ClientPreviewPin, 'id'>): void {
    const threadId = createId('thread');
    const nextPin: ClientPreviewPin = {
      id: createId('pin'),
      ...pin,
    };
    setThreads((current) => [{ id: threadId, pin: nextPin, comments: [] }, ...current]);
    setActiveThreadId(threadId);
    setReplyThreadId(null);
    setReplyParentId(null);
    setPinMode(false);
  }

  function startReply(threadId: string, parentId?: string): void {
    setReplyThreadId(threadId);
    setReplyParentId(parentId ?? null);
    setActiveThreadId(threadId);
  }

  function cancelReply(): void {
    setReplyThreadId(null);
    setReplyParentId(null);
  }

  return {
    threads,
    visibleThreads,
    activeThreadId,
    setActiveThreadId,
    replyThreadId,
    pinMode,
    setPinMode,
    addComment,
    addPinnedThread,
    startReply,
    cancelReply,
  };
}
