import './shared/theme.css';
import './shared/layout.css';
import { ClientPreviewShell } from './features/client-preview/ClientPreviewShell';
import { readClientPreviewRoute } from './features/client-preview/project-loader';
import { AutosaveGate } from './persistence/autosave/AutosaveGate';
import { PlatformShell } from './platform/PlatformShell';
import { FontAssetRuntime } from './assets/FontAssetRuntime';
import { ToastProvider } from './shared/ui/ToastProvider';
import { AnimationEngineProvider } from './motion/animation-engine';
import { registerBuiltins } from './widgets/registry/register-builtins';

registerBuiltins();

export default function App(): JSX.Element {
  const previewRoute = typeof window !== 'undefined' ? readClientPreviewRoute(window.location) : null;

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
