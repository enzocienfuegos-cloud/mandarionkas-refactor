import './shared/theme.css';
import './shared/layout.css';
import { ClientPreviewShell } from './features/client-preview/ClientPreviewShell';
import { readClientPreviewRoute } from './features/client-preview/project-loader';
import { AutosaveGate } from './persistence/autosave/AutosaveGate';
import { PlatformShell } from './platform/PlatformShell';
import { FontAssetRuntime } from './assets/FontAssetRuntime';
import { ToastProvider } from './shared/ui/ToastProvider';

export default function App(): JSX.Element {
  const previewRoute = typeof window !== 'undefined' ? readClientPreviewRoute(window.location) : null;

  return (
    <ToastProvider>
      <AutosaveGate />
      <FontAssetRuntime />
      {previewRoute
        ? <ClientPreviewShell projectId={previewRoute.projectId} token={previewRoute.token} />
        : <PlatformShell />}
    </ToastProvider>
  );
}
