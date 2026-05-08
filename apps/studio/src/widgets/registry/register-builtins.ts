import { builtinWidgetPlugins } from './builtin-widget-plugins';
import { registerWidgetPlugins } from './widget-registry';
import { registerDocumentInspectorBuiltins } from '../../inspector/register-document-inspector';

let registered = false;

export function registerBuiltins(): void {
  if (registered) return;
  registerWidgetPlugins(builtinWidgetPlugins);
  registerDocumentInspectorBuiltins();
  registered = true;
}
