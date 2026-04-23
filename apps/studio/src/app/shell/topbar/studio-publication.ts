import { prepareExportStateWithResolvedAssets } from '../../../export/asset-resolution';
import { buildExportBundleWithRemoteAssets, type ExportBundle, type ExportBundleFile } from '../../../export/bundle';
import type { StudioState } from '../../../domain/document/types';
import { fetchJson } from '../../../shared/net/http-json';
import { getApiBaseUrl } from '../../../config/runtime';

type SerializedBundleFile = {
  path: string;
  mime: string;
  encoding: 'text' | 'base64';
  content: string;
};

type CreativePublicationResponse = {
  creative: {
    id: string;
    name: string;
  };
  creativeVersion: {
    id: string;
    status: string;
    public_url?: string;
  };
  artifacts: Array<{
    id: string;
    kind: string;
    public_url?: string;
  }>;
};

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function serializeBundleFile(file: ExportBundleFile): SerializedBundleFile {
  if (typeof file.content === 'string') {
    return {
      path: file.path,
      mime: file.mime,
      encoding: 'text',
      content: file.content,
    };
  }

  if (file.bytes instanceof Uint8Array) {
    return {
      path: file.path,
      mime: file.mime,
      encoding: 'base64',
      content: encodeBase64(file.bytes),
    };
  }

  return {
    path: file.path,
    mime: file.mime,
    encoding: 'text',
    content: '',
  };
}

function serializeBundle(bundle: ExportBundle) {
  return {
    channel: bundle.channel,
    files: bundle.files.map(serializeBundleFile),
  };
}

export async function publishStudioProjectToAdServer(state: StudioState, options: {
  projectId?: string;
  autoSubmitForReview?: boolean;
} = {}): Promise<CreativePublicationResponse> {
  const preparedState = await prepareExportStateWithResolvedAssets(state);
  const bundle = await buildExportBundleWithRemoteAssets(preparedState);
  const canvas = preparedState.document.canvas ?? {};

  return fetchJson<CreativePublicationResponse>(`${getApiBaseUrl()}/creative-publications/from-studio`, {
    method: 'POST',
    body: JSON.stringify({
      name: preparedState.document.name || 'Untitled creative',
      projectId: options.projectId,
      projectName: preparedState.document.name || 'Untitled Project',
      channel: bundle.channel,
      autoSubmitForReview: options.autoSubmitForReview !== false,
      metadata: {
        documentId: preparedState.document.id,
        canvas: {
          width: typeof canvas.width === 'number' ? canvas.width : null,
          height: typeof canvas.height === 'number' ? canvas.height : null,
          presetId: canvas.presetId ?? null,
        },
      },
      bundle: serializeBundle(bundle),
    }),
  });
}
