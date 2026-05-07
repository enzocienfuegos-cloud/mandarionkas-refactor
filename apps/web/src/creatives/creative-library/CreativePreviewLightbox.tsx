import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Icons, Modal } from '../../system';
import type { PreviewModalState } from './types';

type Props = {
  preview: PreviewModalState;
  onClose: () => void;
};

function formatPlaybackTime(valueSeconds: number) {
  if (!Number.isFinite(valueSeconds) || valueSeconds <= 0) return '0:00';
  const minutes = Math.floor(valueSeconds / 60);
  const seconds = Math.floor(valueSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = units[0];
  for (let index = 0; index < units.length - 1 && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index + 1];
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function formatDuration(valueMs?: number | null) {
  if (!valueMs || valueMs <= 0) return null;
  return formatPlaybackTime(valueMs / 1000);
}

function previewKindLabel(preview: PreviewModalState) {
  if (preview.kind === 'video') return 'Video preview';
  if (preview.kind === 'image') return 'Image preview';
  return 'HTML5 preview';
}

function PreviewMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[color:var(--dusk-border-default)] bg-surface-2 px-3 py-1 text-xs text-text-soft">
      <span className="text-text-muted">{label}</span>
      <span className="ml-2 font-medium text-text-primary">{value}</span>
    </div>
  );
}

function VideoPreviewSurface({ preview }: { preview: PreviewModalState }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(preview.durationMs ? preview.durationMs / 1000 : 0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const syncState = () => {
      setCurrentTime(video.currentTime);
      setDurationSeconds(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : (preview.durationMs ? preview.durationMs / 1000 : 0));
      setIsPlaying(!video.paused && !video.ended);
      setIsMuted(video.muted || video.volume === 0);
    };

    const handleLoadedMetadata = () => {
      setIsReady(true);
      setHasError(false);
      syncState();
    };

    const handleCanPlay = () => {
      setIsReady(true);
      setHasError(false);
      syncState();
    };

    const handleError = () => {
      setHasError(true);
      setIsReady(false);
      setIsPlaying(false);
    };

    syncState();
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', syncState);
    video.addEventListener('pause', syncState);
    video.addEventListener('timeupdate', syncState);
    video.addEventListener('volumechange', syncState);
    video.addEventListener('ended', syncState);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', syncState);
      video.removeEventListener('pause', syncState);
      video.removeEventListener('timeupdate', syncState);
      video.removeEventListener('volumechange', syncState);
      video.removeEventListener('ended', syncState);
      video.removeEventListener('error', handleError);
    };
  }, [preview.durationMs]);

  const progressPercent = useMemo(() => (
    durationSeconds > 0 ? Math.min(100, (currentTime / durationSeconds) * 100) : 0
  ), [currentTime, durationSeconds]);

  const handleTogglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setHasError(true);
      }
      return;
    }
    video.pause();
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !durationSeconds) return;
    const nextValue = Number(event.target.value);
    const nextTime = (nextValue / 100) * durationSeconds;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleRestart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {
      setHasError(true);
    });
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[28px] border border-[color:var(--dusk-border-default)] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_55%),linear-gradient(180deg,rgba(11,16,32,0.94),rgba(6,10,20,0.98))] shadow-overlay">
        <div
          className="relative flex min-h-[320px] items-center justify-center bg-black"
          style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
        >
          <video
            ref={videoRef}
            src={preview.url}
            poster={preview.posterUrl || undefined}
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
            title={`Preview: ${preview.name}`}
          />
          {!isReady && !hasError ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
              <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
                Loading preview…
              </div>
            </div>
          ) : null}
          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6">
              <div className="max-w-md rounded-2xl border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-5 py-4 text-center text-sm text-[color:var(--dusk-status-critical-fg)]">
                This video preview could not be loaded. Open it in a new tab to inspect the asset directly.
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 bg-black/40 px-5 py-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{preview.name}</p>
              <p className="mt-1 text-xs text-white/60">
                {previewKindLabel(preview)}
                {preview.mimeType ? ` · ${preview.mimeType}` : ''}
              </p>
            </div>
            <Badge tone={hasError ? 'critical' : isReady ? 'success' : 'info'}>
              {hasError ? 'Unavailable' : isPlaying ? 'Playing' : isReady ? 'Ready' : 'Preparing'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={isPlaying ? <Icons.Pause /> : <Icons.Play />}
              onClick={() => void handleTogglePlayback()}
              disabled={hasError}
              className="min-w-[112px] border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={isMuted ? <Icons.VolumeX /> : <Icons.Volume2 />}
              onClick={handleToggleMute}
              disabled={hasError}
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestart}
              disabled={hasError}
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              Restart
            </Button>
            <div className="ml-auto flex min-w-[140px] justify-end text-sm text-white/70">
              {formatPlaybackTime(currentTime)} / {formatPlaybackTime(durationSeconds)}
            </div>
          </div>

          <div className="mt-3">
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progressPercent}
              onChange={handleSeek}
              disabled={!durationSeconds || hasError}
              aria-label="Seek video preview"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[color:var(--dusk-brand-fuchsia)] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePreviewSurface({ preview }: { preview: PreviewModalState }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[color:var(--dusk-border-default)] bg-[linear-gradient(180deg,rgba(12,17,30,0.98),rgba(7,10,18,1))] shadow-overlay">
      <div
        className="flex items-center justify-center bg-black"
        style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
      >
        <img
          src={preview.url}
          alt={`Preview: ${preview.name}`}
          className="max-h-[70vh] w-full object-contain"
        />
      </div>
    </div>
  );
}

function HtmlPreviewSurface({ preview }: { preview: PreviewModalState }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-2)] shadow-overlay">
      <iframe
        src={preview.url}
        title={`Preview: ${preview.name}`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        className="block h-[70vh] w-full bg-white"
      />
    </div>
  );
}

export function CreativePreviewLightbox({ preview, onClose }: Props) {
  const mediaDetails = [
    preview.width > 0 && preview.height > 0 ? { label: 'Canvas', value: `${preview.width}×${preview.height}` } : null,
    preview.kind === 'video' && formatDuration(preview.durationMs) ? { label: 'Duration', value: String(formatDuration(preview.durationMs)) } : null,
    formatFileSize(preview.fileSizeBytes) ? { label: 'Asset', value: String(formatFileSize(preview.fileSizeBytes)) } : null,
    preview.sourceKind ? { label: 'Source', value: preview.sourceKind.replace(/_/g, ' ') } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={preview.name}
      description={previewKindLabel(preview)}
      footer={(
        <>
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[color:var(--dusk-border-default)] px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          >
            <Icons.ExternalLink className="h-4 w-4" />
            Open in tab
          </a>
          <a
            href={preview.url}
            download
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[color:var(--dusk-border-default)] px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          >
            <Icons.Download className="h-4 w-4" />
            Download asset
          </a>
          <Button variant="ghost" onClick={onClose}>
            Close preview
          </Button>
        </>
      )}
    >
      <div className="space-y-5">
        {mediaDetails.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {mediaDetails.map((detail) => (
              <PreviewMetaPill key={`${detail.label}-${detail.value}`} label={detail.label} value={detail.value} />
            ))}
          </div>
        ) : null}

        {preview.kind === 'video' ? (
          <VideoPreviewSurface preview={preview} />
        ) : preview.kind === 'image' ? (
          <ImagePreviewSurface preview={preview} />
        ) : (
          <HtmlPreviewSurface preview={preview} />
        )}
      </div>
    </Modal>
  );
}
