import { useEffect, useState } from 'react';
import {
  completeCreativeIngestion,
  createCreativeIngestionUpload,
  loadCreativeIngestion,
  publishCreativeIngestion,
  uploadFileViaApiProxy,
  type CreativeIngestion,
} from '../catalog';
import { loadWorkspaces, type WorkspaceOption } from '../../shared/workspaces';
import {
  buildFileKey,
  detectHtml5ZipClickUrl,
  formatProcessingEta,
  getDisplayProcessingPercent,
  getProcessingStageMessage,
  getPublishJob,
  normalizeHttpUrl,
  readVideoFileMetadata,
  type SourceKind,
} from './utils';

const MAX_PARALLEL_UPLOADS = 4;
const CREATIVE_PROCESSING_POLL_INTERVAL_MS = 2000;
const MAX_CREATIVE_PROCESSING_POLLS = 60;

type Params = {
  onComplete: () => void;
};

type ClickUrlState = {
  manualByFileKey: Record<string, string>;
  detectedByFileKey: Record<string, string>;
  detectingFileKeys: string[];
};

type UploadFeedbackState = {
  status: string;
  error: string;
  loading: boolean;
};

type UploadProgressState = {
  currentFileName: string;
  currentFileProgress: number;
  currentProcessingName: string;
  currentProcessingProgress: number;
  currentProcessingEta: string;
  currentProcessingMessage: string;
  overallProgress: number;
};

type WorkspaceState = {
  workspaces: WorkspaceOption[];
  workspaceId: string;
};

const EMPTY_PROGRESS: UploadProgressState = {
  currentFileName: '',
  currentFileProgress: 0,
  currentProcessingName: '',
  currentProcessingProgress: 0,
  currentProcessingEta: '',
  currentProcessingMessage: '',
  overallProgress: 0,
};

export function useCreativeUploadWorkspace({ onComplete }: Params) {
  const [sourceKind, setSourceKind] = useState<SourceKind>('html5_zip');
  const [files, setFiles] = useState<File[]>([]);
  const [clickUrlState, setClickUrlState] = useState<ClickUrlState>({
    manualByFileKey: {},
    detectedByFileKey: {},
    detectingFileKeys: [],
  });
  const [feedback, setFeedback] = useState<UploadFeedbackState>({
    status: '',
    error: '',
    loading: false,
  });
  const [progress, setProgress] = useState<UploadProgressState>(EMPTY_PROGRESS);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    workspaces: [],
    workspaceId: '',
  });

  useEffect(() => {
    loadWorkspaces()
      .then((workspaceList) => {
        setWorkspaceState((current) => ({
          ...current,
          workspaces: workspaceList,
          workspaceId: current.workspaceId || workspaceList[0]?.id || '',
        }));
      })
      .catch(() => {});
  }, []);

  const setWorkspaceId = (workspaceId: string) => {
    setWorkspaceState((current) => ({ ...current, workspaceId }));
  };

  const setSourceKindAndReset = (nextSourceKind: SourceKind) => {
    setSourceKind(nextSourceKind);
    setFiles([]);
    setClickUrlState({
      manualByFileKey: {},
      detectedByFileKey: {},
      detectingFileKeys: [],
    });
    setFeedback((current) => ({ ...current, error: '' }));
    setProgress(EMPTY_PROGRESS);
  };

  const clearFiles = () => {
    setFiles([]);
    setClickUrlState({
      manualByFileKey: {},
      detectedByFileKey: {},
      detectingFileKeys: [],
    });
  };

  const setClickUrlForFile = (file: File, value: string) => {
    const fileKey = buildFileKey(file);
    setClickUrlState((current) => ({
      ...current,
      manualByFileKey: {
        ...current.manualByFileKey,
        [fileKey]: value,
      },
    }));
  };

  const mergeFiles = (incomingFiles: File[]) => {
    setFiles((currentFiles) => {
      const nextFiles = [...currentFiles];
      const seen = new Set(currentFiles.map((file) => buildFileKey(file)));
      const queuedForDetection: File[] = [];

      for (const file of incomingFiles) {
        const key = buildFileKey(file);
        if (seen.has(key)) continue;
        seen.add(key);
        nextFiles.push(file);
        if (sourceKind === 'html5_zip') {
          queuedForDetection.push(file);
        }
      }

      if (queuedForDetection.length) {
        const keys = queuedForDetection.map(buildFileKey);
        setClickUrlState((current) => ({
          ...current,
          detectingFileKeys: Array.from(new Set([...current.detectingFileKeys, ...keys])),
        }));
        void Promise.all(queuedForDetection.map(async (file) => {
          const fileKey = buildFileKey(file);
          const detectedClickUrl = await detectHtml5ZipClickUrl(file);
          if (detectedClickUrl) {
            setClickUrlState((current) => ({
              manualByFileKey: {
                ...current.manualByFileKey,
                ...(current.manualByFileKey[fileKey] ? {} : { [fileKey]: detectedClickUrl }),
              },
              detectedByFileKey: {
                ...current.detectedByFileKey,
                [fileKey]: detectedClickUrl,
              },
              detectingFileKeys: current.detectingFileKeys,
            }));
          }
        })).finally(() => {
          setClickUrlState((current) => ({
            ...current,
            detectingFileKeys: current.detectingFileKeys.filter((key) => !keys.includes(key)),
          }));
        });
      }

      return nextFiles;
    });

    setFeedback((current) => ({ ...current, error: '' }));
  };

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (files.length === 0) {
      setFeedback((current) => ({ ...current, error: 'Select at least one file first.' }));
      return;
    }
    if (!workspaceState.workspaceId) {
      setFeedback((current) => ({ ...current, error: 'Select a client before uploading.' }));
      return;
    }

    const invalidClickUrlFile = files.find((file) => {
      const rawValue = clickUrlState.manualByFileKey[buildFileKey(file)] ?? '';
      return rawValue.trim() && !normalizeHttpUrl(rawValue);
    });
    if (invalidClickUrlFile) {
      setFeedback((current) => ({
        ...current,
        error: `"${invalidClickUrlFile.name}" has an invalid destination URL. Use a full http(s) URL.`,
      }));
      return;
    }
    const missingDestinationUrlFile = files.find((file) => {
      const fileKey = buildFileKey(file);
      const resolvedDestinationUrl = normalizeHttpUrl(
        clickUrlState.manualByFileKey[fileKey]
        ?? clickUrlState.detectedByFileKey[fileKey]
        ?? '',
      );
      return !resolvedDestinationUrl;
    });

    if (missingDestinationUrlFile) {
      setFeedback((current) => ({
        ...current,
        error: sourceKind === 'video_mp4'
          ? `"${missingDestinationUrlFile.name}" needs a destination URL before upload.`
          : `"${missingDestinationUrlFile.name}" needs a destination URL. Add one manually or wait for clickTag detection to populate it.`,
      }));
      return;
    }

    if (sourceKind === 'html5_zip' && clickUrlState.detectingFileKeys.length > 0) {
      setFeedback((current) => ({
        ...current,
        error: 'Please wait for HTML5 clickTag detection to finish before uploading.',
      }));
      return;
    }

    setFeedback({
      status: 'Preparing uploads…',
      error: '',
      loading: true,
    });
    setProgress(EMPTY_PROGRESS);

    const loadedBytesByIndex = files.map(() => 0);
    const activeIndexes = new Set<number>();
    const processingStartedAtByIndex = files.map(() => 0);
    const activeProcessingIndexes = new Set<number>();
    const processingStateByIndex = files.map<CreativeIngestion | null>(() => null);

    const refreshOverallProgress = () => {
      const combinedProgress = files.map((file, index) => {
        const size = file.size || 0;
        const uploadPercent = size > 0
          ? Math.min(100, Math.round((loadedBytesByIndex[index] / size) * 100))
          : 0;
        if (uploadPercent < 100) {
          return Math.round(uploadPercent * 0.5);
        }
        const processingPercent = getDisplayProcessingPercent(
          processingStateByIndex[index],
          Date.now() - (processingStartedAtByIndex[index] || Date.now()),
        );
        return Math.min(100, 50 + Math.round(processingPercent * 0.5));
      });
      const overallProgress = combinedProgress.length
        ? Math.round(combinedProgress.reduce((sum, value) => sum + value, 0) / combinedProgress.length)
        : 0;
      setProgress((current) => ({ ...current, overallProgress }));
    };

    const refreshActiveProgress = () => {
      if (activeIndexes.size === 0) {
        setProgress((current) => ({
          ...current,
          currentFileName: '',
          currentFileProgress: 0,
        }));
        return;
      }
      const indexes = Array.from(activeIndexes.values()).sort((a, b) => a - b);
      const names = indexes.map(index => files[index]?.name).filter(Boolean);
      const currentFileProgress = Math.round(
        indexes.reduce((sum, index) => {
          const size = files[index]?.size || 0;
          if (size <= 0) return sum;
          return sum + Math.min(100, Math.round((loadedBytesByIndex[index] / size) * 100));
        }, 0) / indexes.length,
      );
      setProgress((current) => ({
        ...current,
        currentFileName: names[0] + (names.length > 1 ? ` +${names.length - 1} more` : ''),
        currentFileProgress,
      }));
    };

    const refreshProcessingProgress = () => {
      if (activeProcessingIndexes.size === 0) {
        setProgress((current) => ({
          ...current,
          currentProcessingName: '',
          currentProcessingProgress: 0,
          currentProcessingEta: '',
          currentProcessingMessage: '',
        }));
        return;
      }
      const indexes = Array.from(activeProcessingIndexes.values()).sort((a, b) => a - b);
      const names = indexes.map(index => files[index]?.name).filter(Boolean);
      const averageProgress = Math.round(
        indexes.reduce((sum, index) => (
          sum + getDisplayProcessingPercent(
            processingStateByIndex[index],
            Date.now() - (processingStartedAtByIndex[index] || Date.now()),
          )
        ), 0) / indexes.length,
      );
      const averageRemainingMs = indexes.reduce((sum, index) => {
        const elapsedMs = Date.now() - (processingStartedAtByIndex[index] || Date.now());
        const completion = getDisplayProcessingPercent(processingStateByIndex[index], elapsedMs);
        if (completion <= 0 || completion >= 100) return sum;
        const estimatedTotalMs = (elapsedMs / completion) * 100;
        return sum + Math.max(0, estimatedTotalMs - elapsedMs);
      }, 0) / indexes.length;
      const primaryState = processingStateByIndex[indexes[0]];
      const publishJob = getPublishJob(primaryState);
      const stage = publishJob?.stage ? String(publishJob.stage) : '';
      setProgress((current) => ({
        ...current,
        currentProcessingName: names[0] + (names.length > 1 ? ` +${names.length - 1} more` : ''),
        currentProcessingProgress: averageProgress,
        currentProcessingEta: formatProcessingEta(averageRemainingMs || 0),
        currentProcessingMessage: getProcessingStageMessage(
          stage,
          String(publishJob?.message ?? 'Transcoding and publishing creative…'),
        ),
      }));
    };

    const processingInterval = window.setInterval(refreshProcessingProgress, 300);

    try {
      const processFile = async (file: File, index: number) => {
        console.info('[upload] step 1: starting file upload', {
          index,
          fileName: file.name,
          fileSize: file.size,
          sourceKind,
        });
        const fileKey = buildFileKey(file);
        const requestedClickUrl = normalizeHttpUrl(
          clickUrlState.manualByFileKey[fileKey]
          ?? clickUrlState.detectedByFileKey[fileKey]
          ?? '',
        ) || null;
        const videoMetadata = sourceKind === 'video_mp4'
          ? await readVideoFileMetadata(file)
          : { width: null, height: null, durationMs: null };

        activeIndexes.add(index);
        refreshActiveProgress();

        const upload = await createCreativeIngestionUpload({
          workspaceId: workspaceState.workspaceId,
          sourceKind,
          file,
          clickUrl: requestedClickUrl,
          ...videoMetadata,
        });
        console.info('[upload] step 2: ingestion created', {
          ingestionId: upload.ingestion.id,
          upload,
        });

        await uploadFileViaApiProxy(upload.upload.uploadUrl, file, ({ loadedBytes, totalBytes }) => {
          loadedBytesByIndex[index] = totalBytes > 0 && loadedBytes >= totalBytes ? totalBytes : loadedBytes;
          refreshOverallProgress();
          refreshActiveProgress();
        });
        console.info('[upload] step 5: upload request completed', {
          ingestionId: upload.ingestion.id,
        });

        loadedBytesByIndex[index] = file.size;
        refreshOverallProgress();
        refreshActiveProgress();

        await completeCreativeIngestion(upload.ingestion.id, {
          workspaceId: workspaceState.workspaceId,
          file,
          publicUrl: upload.upload.publicUrl,
          storageKey: upload.upload.storageKey,
          clickUrl: requestedClickUrl,
          ...videoMetadata,
        });
        console.info('[upload] step 6: ingestion marked complete', {
          ingestionId: upload.ingestion.id,
        });

        processingStartedAtByIndex[index] = Date.now();
        activeProcessingIndexes.add(index);
        setFeedback((current) => ({
          ...current,
          status: `Upload complete. Processing ${files.length} creative${files.length === 1 ? '' : 's'} in the background…`,
        }));

        const publishResult = await publishCreativeIngestion(upload.ingestion.id, {
          workspaceId: workspaceState.workspaceId,
          clickUrl: requestedClickUrl,
        });
        console.info('[upload] step 7: publish started', {
          ingestionId: upload.ingestion.id,
          publishStatus: publishResult.ingestion?.status ?? null,
        });
        processingStateByIndex[index] = publishResult.ingestion ?? null;
        refreshOverallProgress();
        refreshProcessingProgress();

        let latestIngestion = publishResult.ingestion;
        let pollCount = 0;
        while (latestIngestion?.status === 'processing') {
          if (pollCount >= MAX_CREATIVE_PROCESSING_POLLS) {
            throw new Error(
              `Creative is still processing after ${(MAX_CREATIVE_PROCESSING_POLLS * CREATIVE_PROCESSING_POLL_INTERVAL_MS) / 1000} seconds. ` +
              'Check the queue panel later; the publish job may still complete in the background.',
            );
          }
          pollCount += 1;
          await new Promise((resolve) => window.setTimeout(resolve, CREATIVE_PROCESSING_POLL_INTERVAL_MS));
          latestIngestion = await loadCreativeIngestion(upload.ingestion.id, { workspaceId: workspaceState.workspaceId });
          processingStateByIndex[index] = latestIngestion;
          refreshOverallProgress();
          refreshProcessingProgress();
        }

        if (latestIngestion?.status === 'published' && latestIngestion.creativeId) {
          try {
            const creativeRes = await fetch(
              `/v1/creatives/${latestIngestion.creativeId}?workspaceId=${workspaceState.workspaceId}`,
              { credentials: 'include' },
            );
            if (creativeRes.ok) {
              const { creative } = await creativeRes.json();
              if (creative?.clickUrl) {
                const fileKey = buildFileKey(file);
                setClickUrlState((current) => ({
                  manualByFileKey: {
                    ...current.manualByFileKey,
                    ...(current.manualByFileKey[fileKey] ? {} : { [fileKey]: creative.clickUrl }),
                  },
                  detectedByFileKey: {
                    ...current.detectedByFileKey,
                    [fileKey]: creative.clickUrl,
                  },
                  detectingFileKeys: current.detectingFileKeys,
                }));
              }
            }
          } catch (_) {}
        }

        if (latestIngestion?.status === 'failed') {
          throw new Error(latestIngestion.errorDetail ?? 'Creative publish failed');
        }

        processingStateByIndex[index] = latestIngestion ?? publishResult.ingestion ?? null;
        activeProcessingIndexes.delete(index);
        activeIndexes.delete(index);
        refreshProcessingProgress();
        refreshActiveProgress();
        refreshOverallProgress();
      };

      const batchSize = Math.min(MAX_PARALLEL_UPLOADS, files.length);
      setFeedback((current) => ({
        ...current,
        status: `Uploading ${files.length} creative${files.length === 1 ? '' : 's'} in batches of ${batchSize}…`,
      }));

      for (let start = 0; start < files.length; start += MAX_PARALLEL_UPLOADS) {
        const batch = files.slice(start, start + MAX_PARALLEL_UPLOADS);
        await Promise.all(batch.map((file, offset) => processFile(file, start + offset)));
      }

      setFeedback({
        status: `${files.length} creative${files.length === 1 ? '' : 's'} published.`,
        error: '',
        loading: false,
      });
      setProgress({
        ...EMPTY_PROGRESS,
        currentFileProgress: 100,
        currentProcessingProgress: 100,
        currentProcessingEta: 'Estimated remaining 0:00',
        currentProcessingMessage: 'Publish completed.',
        overallProgress: 100,
      });
      setClickUrlState({
        manualByFileKey: {},
        detectedByFileKey: {},
        detectingFileKeys: [],
      });
      window.setTimeout(onComplete, 1200);
    } catch (submitError: any) {
      console.error('[upload] FAILED', submitError);
      setFeedback({
        status: '',
        error: submitError.message ?? 'Upload failed',
        loading: false,
      });
    } finally {
      console.info('[upload] cleanup');
      window.clearInterval(processingInterval);
      setFeedback((current) => ({ ...current, loading: false }));
    }
  };

  return {
    sourceKind,
    files,
    clickUrlsByFileKey: clickUrlState.manualByFileKey,
    detectedClickUrls: clickUrlState.detectedByFileKey,
    detectingFileKeys: clickUrlState.detectingFileKeys,
    status: feedback.status,
    error: feedback.error,
    loading: feedback.loading,
    currentFileName: progress.currentFileName,
    currentFileProgress: progress.currentFileProgress,
    currentProcessingName: progress.currentProcessingName,
    currentProcessingProgress: progress.currentProcessingProgress,
    currentProcessingEta: progress.currentProcessingEta,
    currentProcessingMessage: progress.currentProcessingMessage,
    overallProgress: progress.overallProgress,
    workspaces: workspaceState.workspaces,
    workspaceId: workspaceState.workspaceId,
    setWorkspaceId,
    setSourceKindAndReset,
    mergeFiles,
    clearFiles,
    setClickUrlForFile,
    handleSubmit,
  };
}
