import type { WidgetNode } from '../../domain/document/types';
import type { WidgetFieldSpec } from '../registry/widget-definition';
import { WidgetFieldInspectorSection } from '../registry/widget-field-inspector';

export function ModuleInspectorSection({ widget, title = 'Module config', fields }: { widget: WidgetNode; title?: string; fields: WidgetFieldSpec[] }): JSX.Element {
  return <WidgetFieldInspectorSection widget={widget} title={title} fields={fields} />;
}
