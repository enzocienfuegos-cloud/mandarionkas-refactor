import { builtinWidgetPlugins } from './builtin-widget-plugins';
import { registerWidgetPlugins } from './widget-registry';

let registered = false;

export function registerBuiltins(): void {
  if (registered) return;
  registerWidgetPlugins(builtinWidgetPlugins);
  registered = true;
}
