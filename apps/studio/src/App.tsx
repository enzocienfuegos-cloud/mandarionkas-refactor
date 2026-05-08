import './shared/theme.css';
import './shared/layout.css';
import { AutosaveGate } from './persistence/autosave/AutosaveGate';
import { PlatformShell } from './platform/PlatformShell';
import { FontAssetRuntime } from './assets/FontAssetRuntime';
import { ToastProvider } from './shared/ui/ToastProvider';

export default function App(): JSX.Element {
  return (
    <ToastProvider>
      <AutosaveGate />
      <FontAssetRuntime />
      <PlatformShell />
    </ToastProvider>
  );
}
