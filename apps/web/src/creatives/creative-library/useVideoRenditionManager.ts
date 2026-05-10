import { useEffect, useState } from 'react';
import {
  loadCreativeIngestion,
  loadCreativeVersionDetail,
  regenerateVideoRenditions,
  updateVideoRenditionById,
  type Creative,
  type CreativeIngestion,
  type CreativeVersion,
} from '../catalog';
import type { RegenerationFeedbackState, VideoRenditionState } from './types';
import {
  estimateRegenerationFeedback,
  estimateRemainingDuration,
  findPendingIngestionForCreative,
  getPendingPublishJob,
  getPublishStageLabel,
  getVideoProcessingPanelSummary,
  shouldPollVideoRenditions,
} from './utils';

type Params = {
  ingestions: CreativeIngestion[];
  setIngestions: React.Dispatch<React.SetStateAction<CreativeIngestion[]>>;
  onReloadCatalog: () => Promise<void>;
};

export function useVideoRenditionManager({ ingestions, setIngestions, onReloadCatalog }: Params) {
  const [videoRenditionState, setVideoRenditionState] = useState<VideoRenditionState | null>(null);
  const [regenerationFeedback, setRegenerationFeedback] = useState<RegenerationFeedbackState | null>(null);

  const openVideoRenditionManager = async (creative: Creative, version: CreativeVersion) => {
    const pendingIngestion = findPendingIngestionForCreative(ingestions, creative, version);
    setVideoRenditionState({
      creativeId: creative.id,
      creativeName: creative.name,
      workspaceId: creative.workspaceId ?? null,
      versionId: version.id,
      loading: true,
      error: '',
      version,
      renditions: [],
      pendingIngestion,
      awaitingPublish: pendingIngestion?.status === 'processing',
    });
    try {
      const detail = await loadCreativeVersionDetail(version.id);
      setVideoRenditionState((current) => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
        awaitingPublish: false,
      } : current);
    } catch (loadError: any) {
      const message = loadError.message ?? 'Failed to load video renditions';
      const missingVersion = String(message).toLowerCase().includes('creative version not found');
      setVideoRenditionState((current) => current ? {
        ...current,
        loading: false,
        error: missingVersion && pendingIngestion?.status === 'processing'
          ? ''
          : message,
        awaitingPublish: missingVersion && pendingIngestion?.status === 'processing',
      } : current);
    }
  };

  const handleVideoRenditionStatusChange = async (
    renditionId: string,
    status: 'active' | 'paused',
  ) => {
    if (!videoRenditionState) return;
    const rendition = videoRenditionState.renditions.find((row) => row.id === renditionId);
    const isReadyToActivate = Boolean(
      rendition?.isSource || (
        rendition?.publicUrl
        && Number(rendition?.sizeBytes || 0) > 0
        && rendition?.metadata?.available === true
      ),
    );
    if (status === 'active' && !isReadyToActivate) {
      setVideoRenditionState((current) => current ? {
        ...current,
        error: 'This rendition is still queued. Wait for transcoding to finish before turning it on.',
      } : current);
      return;
    }
    setVideoRenditionState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateVideoRenditionById({ renditionId, status });
      const detail = await loadCreativeVersionDetail(videoRenditionState.versionId);
      setVideoRenditionState((current) => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
      } : current);
    } catch (updateError: any) {
      setVideoRenditionState((current) => current ? {
        ...current,
        loading: false,
        error: updateError.message ?? 'Failed to update video rendition',
      } : current);
    }
  };

  const handleRegenerateVideoRenditions = async () => {
    if (!videoRenditionState) return;
    if (videoRenditionState.awaitingPublish) {
      setVideoRenditionState((current) => current ? {
        ...current,
        error: 'This video is still publishing in the background. Renditions will appear when publishing completes.',
      } : current);
      return;
    }
    const startedAt = Date.now();
    const initialFeedback = estimateRegenerationFeedback(0);
    setRegenerationFeedback({
      active: true,
      startedAt,
      elapsedMs: 0,
      stageLabel: initialFeedback.stageLabel,
      progressPercent: initialFeedback.progressPercent,
    });
    setVideoRenditionState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      await regenerateVideoRenditions(videoRenditionState.versionId);
      setRegenerationFeedback((current) => current ? {
        ...current,
        elapsedMs: Date.now() - current.startedAt,
        stageLabel: 'Refreshing rendition details…',
        progressPercent: 98,
      } : current);
      const detail = await loadCreativeVersionDetail(videoRenditionState.versionId);
      setVideoRenditionState((current) => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
      } : current);
      setRegenerationFeedback((current) => current ? {
        ...current,
        active: false,
        elapsedMs: Date.now() - current.startedAt,
        stageLabel: 'Renditions updated',
        progressPercent: 100,
      } : current);
      await onReloadCatalog();
      window.setTimeout(() => {
        setRegenerationFeedback((current) => current?.progressPercent === 100 ? null : current);
      }, 1800);
    } catch (regenerateError: any) {
      setVideoRenditionState((current) => current ? {
        ...current,
        loading: false,
        error: regenerateError.message ?? 'Failed to regenerate video renditions',
      } : current);
      setRegenerationFeedback(null);
    }
  };

  useEffect(() => {
    if (!regenerationFeedback?.active) return undefined;

    const intervalId = window.setInterval(() => {
      setRegenerationFeedback((current) => {
        if (!current?.active) return current;
        const elapsedMs = Date.now() - current.startedAt;
        const estimate = estimateRegenerationFeedback(elapsedMs);
        return {
          ...current,
          elapsedMs,
          stageLabel: estimate.stageLabel,
          progressPercent: estimate.progressPercent,
        };
      });
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [regenerationFeedback?.active]);

  useEffect(() => {
    if (!videoRenditionState?.awaitingPublish || !videoRenditionState.pendingIngestion?.id) return undefined;

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const latestIngestion = await loadCreativeIngestion(videoRenditionState.pendingIngestion!.id, {
            workspaceId: videoRenditionState.workspaceId ?? undefined,
          });
          if (cancelled) return;

          setIngestions((current) => current.map((ingestion) => (
            ingestion.id === latestIngestion.id ? latestIngestion : ingestion
          )));

          if (latestIngestion.status === 'published' && latestIngestion.creativeVersionId) {
            try {
              const detail = await loadCreativeVersionDetail(latestIngestion.creativeVersionId);
              if (cancelled) return;
              setVideoRenditionState((current) => current ? {
                ...current,
                versionId: latestIngestion.creativeVersionId ?? current.versionId,
                version: detail.creativeVersion,
                renditions: detail.videoRenditions,
                pendingIngestion: latestIngestion,
                awaitingPublish: false,
                loading: false,
                error: '',
              } : current);
              await onReloadCatalog();
            } catch {
              if (cancelled) return;
            }
            return;
          }

          setVideoRenditionState((current) => current ? {
            ...current,
            pendingIngestion: latestIngestion,
            awaitingPublish: latestIngestion.status === 'processing',
            error: latestIngestion.status === 'failed'
              ? latestIngestion.errorDetail ?? 'Background publish failed'
              : current.error,
          } : current);
        } catch (pollError: any) {
          if (cancelled) return;
          const status = pollError?.status ?? pollError?.statusCode ?? 0;
          if (status >= 400 && status < 500) {
            setVideoRenditionState((current) => current ? {
              ...current,
              loading: false,
              error: pollError?.message ?? 'Creative version not found.',
            } : current);
          }
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    onReloadCatalog,
    setIngestions,
    videoRenditionState?.awaitingPublish,
    videoRenditionState?.pendingIngestion?.id,
    videoRenditionState?.workspaceId,
  ]);

  useEffect(() => {
    if (!shouldPollVideoRenditions(videoRenditionState)) return undefined;

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const currentVersionId = videoRenditionState?.versionId;
          if (!currentVersionId) return;
          const detail = await loadCreativeVersionDetail(currentVersionId);
          if (cancelled) return;
          setVideoRenditionState((current) => current ? {
            ...current,
            version: detail.creativeVersion,
            renditions: detail.videoRenditions,
            loading: false,
            error: current.error,
          } : current);
        } catch (pollError: any) {
          if (cancelled) return;
          const status = pollError?.status ?? pollError?.statusCode ?? 0;
          const is4xx = (status >= 400 && status < 500)
            || String(pollError?.message ?? '').includes('400')
            || String(pollError?.message ?? '').toLowerCase().includes('not found');
          if (is4xx) {
            setVideoRenditionState((current) => current ? {
              ...current,
              loading: false,
              error: pollError?.message ?? 'Creative version not found.',
            } : current);
          }
        }
      })();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    videoRenditionState?.versionId,
    videoRenditionState?.awaitingPublish,
    videoRenditionState?.loading,
    videoRenditionState?.version?.updatedAt,
    videoRenditionState?.renditions.length,
  ]);

  const videoProcessing = (videoRenditionState?.version?.metadata as Record<string, any> | undefined)?.videoProcessing;
  const plannedRenditions = Array.isArray(videoProcessing?.targetPlan) ? videoProcessing.targetPlan : [];
  const renditionProcessing = Array.isArray(videoProcessing?.renditionProcessing) ? videoProcessing.renditionProcessing : [];
  const videoProcessingSummary = getVideoProcessingPanelSummary(
    videoRenditionState?.version,
    videoRenditionState?.awaitingPublish ?? false,
    videoRenditionState?.renditions ?? [],
  );
  const estimatedRemainingMs = regenerationFeedback
    ? estimateRemainingDuration(regenerationFeedback.elapsedMs, regenerationFeedback.progressPercent)
    : null;
  const pendingPublishJob = getPendingPublishJob(videoRenditionState?.pendingIngestion);
  const pendingPublishPercent = Math.min(100, Math.max(0, Number(pendingPublishJob?.progressPercent ?? 0) || 0));
  const pendingPublishStage = String(pendingPublishJob?.stage ?? '');
  const pendingPublishMessage = String(
    pendingPublishJob?.message
    ?? getPublishStageLabel(pendingPublishStage),
  );

  return {
    videoRenditionState,
    setVideoRenditionState,
    regenerationFeedback,
    openVideoRenditionManager,
    handleVideoRenditionStatusChange,
    handleRegenerateVideoRenditions,
    plannedRenditions,
    renditionProcessing,
    videoProcessing,
    videoProcessingSummary,
    estimatedRemainingMs,
    pendingPublishPercent,
    pendingPublishStage,
    pendingPublishMessage,
  };
}
