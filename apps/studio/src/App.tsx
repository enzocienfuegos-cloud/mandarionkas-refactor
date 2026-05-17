import './shared/theme.css';
import './shared/layout.css';
import { useEffect, useState } from 'react';
import { ClientPreviewShell } from './features/client-preview/ClientPreviewShell';
import { readClientPreviewRoute } from './features/client-preview/project-loader';
import { AutosaveGate } from './persistence/autosave/AutosaveGate';
import { PlatformShell } from './platform/PlatformShell';
import { FontAssetRuntime } from './assets/FontAssetRuntime';
import { ToastProvider } from './shared/ui/ToastProvider';
import { AnimationEngineProvider } from './motion/animation-engine';
import { registerBuiltins } from './widgets/registry/register-builtins';

registerBuiltins();

function AnimationEngineVisualRoute(): JSX.Element | null {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void import('./testing/visual/animation-engine-harness')
      .then(({ bootAnimationEngineVisualHarness }) => {
        if (!cancelled) {
          bootAnimationEngineVisualHarness();
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown animation harness error';
          setErrorMessage(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!errorMessage) {
    return null;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#111827',
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        padding: '24px',
      }}
    >
      <pre
        style={{
          margin: 0,
          maxWidth: '720px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {`Animation engine visual harness failed to boot:\n${errorMessage}`}
      </pre>
    </main>
  );
}

export default function App(): JSX.Element {
  const previewRoute = typeof window !== 'undefined' ? readClientPreviewRoute(window.location) : null;
  const isAnimationHarnessRoute =
    typeof window !== 'undefined' && window.location.pathname === '/animation-engine-visual.html';

  if (isAnimationHarnessRoute) {
    return <AnimationEngineVisualRoute />;
  }

  if (previewRoute) {
    return (
      <AnimationEngineProvider>
        <ToastProvider>
          <ClientPreviewShell projectId={previewRoute.projectId} token={previewRoute.token} />
        </ToastProvider>
      </AnimationEngineProvider>
    );
  }

  return (
    <AnimationEngineProvider>
      <ToastProvider>
        <AutosaveGate />
        <FontAssetRuntime />
        <PlatformShell />
      </ToastProvider>
    </AnimationEngineProvider>
  );
}
