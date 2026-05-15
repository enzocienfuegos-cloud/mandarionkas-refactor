import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { restoreSession } from './auth-service';
import { usePlatformSnapshot } from './runtime';
import { getPlatformServices } from './services';
import { loadAutosaveDraft } from '../repositories/document';
import { loadProject } from '../repositories/project';
import { replaceStudioState } from '../core/store/studio-store';
import { syncDocumentCanvasToVariant } from '../domain/document/canvas-variants';
import { readEditorSessionSnapshot } from '../app/shell/editor-session-storage';
import { EditorSessionPersistenceGate } from '../app/shell/EditorSessionPersistenceGate';

const LoginScreen = lazy(async () => {
  const module = await import('./LoginScreen');
  return { default: module.LoginScreen };
});

const StudioShell = lazy(async () => {
  const module = await import('../app/shell/StudioShell');
  return { default: module.StudioShell };
});

const WorkspaceHub = lazy(async () => {
  const module = await import('./WorkspaceHub');
  return { default: module.WorkspaceHub };
});

const AgencyShell = lazy(async () => {
  const module = await import('./AgencyShell');
  return { default: module.AgencyShell };
});

type PlatformRoute =
  | { kind: 'agency'; search?: string }
  | { kind: 'client-workspace'; clientId?: string; search?: string }
  | { kind: 'editor'; search?: string };

function readRouteFromHash(): PlatformRoute {
  if (typeof window === 'undefined') return { kind: 'agency' };
  const hash = window.location.hash.replace(/^#/, '');
  const [path = '/hub', search = ''] = hash.split('?');
  if (path === '/editor') return { kind: 'editor', search };
  if (path.startsWith('/hub/client/')) {
    return { kind: 'client-workspace', clientId: decodeURIComponent(path.slice('/hub/client/'.length)), search };
  }
  return { kind: 'agency', search };
}

function routeToHash(route: PlatformRoute): string {
  const suffix = route.search ? `?${route.search}` : '';
  switch (route.kind) {
    case 'editor':
      return `#/editor${suffix}`;
    case 'client-workspace':
      return route.clientId ? `#/hub/client/${encodeURIComponent(route.clientId)}${suffix}` : `#/hub/client${suffix}`;
    case 'agency':
    default:
      return `#/hub${suffix}`;
  }
}

export function PlatformShell(): JSX.Element {
  const snapshot = usePlatformSnapshot();
  const isAuthenticated = snapshot.session.isAuthenticated;
  const [route, setRoute] = useState<PlatformRoute>(readRouteFromHash);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const editorResumeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().finally(() => {
      if (!cancelled) setIsRestoringSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isRestoringSession) return;
    if (!isAuthenticated) {
      setRoute({ kind: 'agency' });
      if (typeof window !== 'undefined') window.location.hash = '#/hub';
    }
  }, [isAuthenticated, isRestoringSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onHashChange = () => setRoute(readRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextHash = routeToHash(route);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [route]);

  useEffect(() => {
    if (isRestoringSession) return;
    if (route.kind !== 'client-workspace' || !route.clientId || snapshot.session.activeClientId === route.clientId) return;
    void getPlatformServices().setActiveClient(route.clientId);
  }, [route, snapshot.session.activeClientId, isRestoringSession]);

  useEffect(() => {
    if (isRestoringSession || !isAuthenticated || route.kind !== 'editor' || editorResumeRef.current) return;
    editorResumeRef.current = true;
    let cancelled = false;

    void (async () => {
      const resumeSnapshot = readEditorSessionSnapshot();
      const draft = await loadAutosaveDraft();
      if (cancelled) return;

      const resumeClientId = draft?.document.metadata.platform?.clientId ?? resumeSnapshot?.clientId;
      if (resumeClientId && snapshot.session.activeClientId !== resumeClientId) {
        await getPlatformServices().setActiveClient(resumeClientId);
      }
      if (cancelled) return;

      if (draft) {
        replaceStudioState(draft);
        return;
      }

      if (!resumeSnapshot?.projectId) return;
      const loaded = await loadProject(resumeSnapshot.projectId);
      if (!loaded || cancelled) return;

      const restored = resumeSnapshot.canvasVariantId && loaded.document.canvasVariants.some((variant) => variant.id === resumeSnapshot.canvasVariantId)
        ? {
            ...loaded,
            document: syncDocumentCanvasToVariant({
              ...loaded.document,
              activeCanvasVariantId: resumeSnapshot.canvasVariantId,
            }),
            ui: { ...loaded.ui, activeProjectId: resumeSnapshot.projectId },
          }
        : { ...loaded, ui: { ...loaded.ui, activeProjectId: resumeSnapshot.projectId } };

      replaceStudioState(restored);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isRestoringSession, route.kind, snapshot.session.activeClientId]);

  return (
    <Suspense fallback={<div className="platform-loading-shell">Loading studio…</div>}>
      <EditorSessionPersistenceGate enabled={!isRestoringSession && isAuthenticated && route.kind === 'editor'} />
      {isRestoringSession
        ? <div className="platform-loading-shell">Loading studio…</div>
        : !isAuthenticated
        ? <LoginScreen />
        : route.kind === 'agency'
          ? (
            <AgencyShell
              onOpenClientWorkspace={(clientId) => setRoute({ kind: 'client-workspace', clientId })}
              onEnterEditor={() => setRoute({ kind: 'editor' })}
            />
          )
          : route.kind === 'client-workspace'
            ? (
              <WorkspaceHub
                onBackToAgencyShell={() => setRoute({ kind: 'agency' })}
                onEnterEditor={() => setRoute({ kind: 'editor' })}
              />
            )
            : <StudioShell onOpenWorkspaceHub={() => setRoute({ kind: 'client-workspace', clientId: snapshot.session.activeClientId })} />}
    </Suspense>
  );
}
