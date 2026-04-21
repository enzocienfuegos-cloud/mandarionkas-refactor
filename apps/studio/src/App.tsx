import './shared/theme.css';
import './shared/layout.css';
import { AutosaveGate } from './persistence/autosave/AutosaveGate';
import { PlatformShell } from './platform/PlatformShell';
import { FontAssetRuntime } from './assets/FontAssetRuntime';

export default function App(): JSX.Element {
  return <>
    <AutosaveGate />
    <FontAssetRuntime />
    <PlatformShell />
  </>;
}
