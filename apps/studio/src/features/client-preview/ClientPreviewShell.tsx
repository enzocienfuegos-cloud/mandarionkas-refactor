import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { ClientPreviewCommentBar } from './ClientPreviewCommentBar';
import { ClientPreviewPlayer } from './ClientPreviewPlayer';
import { loadClientPreviewProject } from './project-loader';
import { useClientPreview } from './use-client-preview';
import type { LoadedClientPreviewProject } from './types';

function buildPreviewTitle(project: LoadedClientPreviewProject): string {
  const brand = project.state.document.metadata.platform?.brandName;
  const campaign = project.state.document.metadata.platform?.campaignName;
  if (brand && campaign) return `${brand} · ${campaign}`;
  return project.state.document.name;
}

export function ClientPreviewShell({
  projectId,
  token,
}: {
  projectId: string;
  token: string;
}): JSX.Element {
  const [project, setProject] = useState<LoadedClientPreviewProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadClientPreviewProject(projectId, token)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setLoadError('No se pudo abrir este preview.');
          setProject(null);
          return;
        }
        setProject(loaded);
        setSceneIndex(0);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'No se pudo abrir este preview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, token]);

  const preview = useClientPreview(projectId, sceneIndex);
  const title = useMemo(() => project ? buildPreviewTitle(project) : 'Client Preview', [project]);

  if (loading) {
    return (
      <div className="client-preview-shell">
        <div className="cp-stage">
          <div className="cp-empty-state">
            <strong>Cargando preview...</strong>
            <small className="muted">Estamos preparando la vista publica del proyecto.</small>
          </div>
        </div>
      </div>
    );
  }

  if (!project || loadError) {
    return (
      <div className="client-preview-shell">
        <div className="cp-stage">
          <div className="cp-error-state">
            <strong>No fue posible abrir el preview</strong>
            <small className="muted">{loadError ?? 'Revisa el enlace o vuelve a generar el acceso de revision.'}</small>
          </div>
        </div>
      </div>
    );
  }

  const scenes = project.state.document.scenes;
  const activeScene = scenes[sceneIndex] ?? scenes[0];

  return (
    <div className="client-preview-shell">
      <header className="cp-topbar">
        <div className="cp-topbar-brand">
          <img
            className="cp-topbar-logo"
            src="/assets/mandarion-logo-white.svg"
            alt="MandaRion"
          />
        </div>
        <div className="cp-topbar-center">
          <div className="cp-topbar-title">{title}</div>
          <div className="cp-topbar-meta">
            <span>Review</span>
            <span>{project.state.document.canvas.width}×{project.state.document.canvas.height}</span>
            <span>{scenes.length} escena{scenes.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="cp-topbar-actions">
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<StudioIcon icon={StudioIcons.copy} size={14} />}
            onClick={() => void navigator.clipboard?.writeText(window.location.href)}
          >
            Share
          </Button>
        </div>
      </header>

      <ClientPreviewPlayer
        state={project.state}
        sceneIndex={sceneIndex}
        threads={preview.visibleThreads}
        activeThreadId={preview.activeThreadId}
        pinMode={preview.pinMode}
        onTogglePinMode={() => preview.setPinMode((current) => !current)}
        onSelectThread={preview.setActiveThreadId}
        onCreatePinnedThread={preview.addPinnedThread}
      />

      <div className="cp-scene-nav">
        <Button
          variant="ghost"
          size="sm"
          disabled={sceneIndex <= 0}
          onClick={() => setSceneIndex((current) => Math.max(0, current - 1))}
        >
          Anterior
        </Button>
        <div className="cp-scene-dots" aria-label="Scene navigation">
          {scenes.map((scene, index) => (
            <button
              key={scene.id}
              type="button"
              className={`cp-scene-dot ${index === sceneIndex ? 'active' : ''}`.trim()}
              aria-label={`Go to scene ${index + 1}`}
              onClick={() => setSceneIndex(index)}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={sceneIndex >= scenes.length - 1}
          onClick={() => setSceneIndex((current) => Math.min(scenes.length - 1, current + 1))}
        >
          Siguiente
        </Button>
      </div>

      <ClientPreviewCommentBar
        sceneLabel={activeScene.name}
        threads={preview.visibleThreads}
        activeThreadId={preview.activeThreadId}
        replyThreadId={preview.replyThreadId}
        pinMode={preview.pinMode}
        onSelectThread={preview.setActiveThreadId}
        onAddComment={preview.addComment}
        onStartReply={preview.startReply}
        onCancelReply={preview.cancelReply}
        onTogglePinMode={() => preview.setPinMode((current) => !current)}
      />
    </div>
  );
}
