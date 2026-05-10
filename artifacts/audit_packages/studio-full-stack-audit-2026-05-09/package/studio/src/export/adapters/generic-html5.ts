import type { StudioState } from '../../domain/document/types';
import { buildPortableProjectExport } from '../portable';
import { buildExportRuntimeModelFromPortable } from '../runtime-model';
import { validatePortableExport } from '../compliance';

export type GenericHtml5AdapterResult = {
  adapter: 'generic-html5';
  version: 1;
  exportedAt: string;
  portableProject: ReturnType<typeof buildPortableProjectExport>;
  runtimeModel: ReturnType<typeof buildExportRuntimeModelFromPortable>;
  compliance: ReturnType<typeof validatePortableExport>;
  htmlShell: {
    entry: 'index.html';
    width: number;
    height: number;
    politeLoad: boolean;
    usesSingleDocument: boolean;
    sceneCount: number;
  };
};

export function buildGenericHtml5Adapter(state: StudioState): GenericHtml5AdapterResult {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const compliance = validatePortableExport(portableProject);

  return {
    adapter: 'generic-html5',
    version: 1,
    exportedAt: new Date().toISOString(),
    portableProject,
    runtimeModel,
    compliance,
    htmlShell: {
      entry: 'index.html',
      width: portableProject.canvas.width,
      height: portableProject.canvas.height,
      politeLoad: true,
      usesSingleDocument: true,
      sceneCount: portableProject.scenes.length,
    },
  };
}
