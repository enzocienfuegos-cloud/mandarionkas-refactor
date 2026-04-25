import {
  listCreativeArtifacts,
  createCreativeArtifact,
  createVideoRendition,
  listVideoRenditions,
  updateVideoRendition,
  updateCreativeVersion,
  updateCreative,
} from '@smx/db';
import { enrichVideoPublication } from './video-processor.mjs';

export async function syncVideoRenditionsForVersion(client, workspaceId, version, creative = null) {
  const artifacts = await listCreativeArtifacts(client, workspaceId, version.id);
  const sourceArtifact = artifacts.find((artifact) =>
    (artifact.storage_key || artifact.public_url)
    && artifact.kind === 'video_mp4'
    && (artifact.metadata?.ingestionId || artifact.metadata?.isSource || artifact.metadata?.generatedBy === 'source_passthrough'),
  ) ?? artifacts.find((artifact) => (artifact.storage_key || artifact.public_url) && artifact.kind === 'video_mp4');

  const sourceStorageKey = sourceArtifact?.storage_key ?? null;
  const sourcePublicUrl = sourceArtifact?.public_url ?? version.public_url ?? creative?.file_url ?? null;

  if (!sourceStorageKey && !sourcePublicUrl) {
    throw new Error('No source MP4 artifact found for this creative version');
  }

  const existingRenditions = await listVideoRenditions(client, workspaceId, version.id);
  const existingByLabel = new Map(
    existingRenditions.map((rendition) => [String(rendition.label ?? '').trim().toLowerCase(), rendition]),
  );
  for (const rendition of existingRenditions) {
    await updateVideoRendition(client, workspaceId, rendition.id, {
      status: 'archived',
      metadata: {
        ...(rendition.metadata ?? {}),
        archivedByRegeneration: true,
        archivedAt: new Date().toISOString(),
      },
    });
  }

  const videoPublication = await enrichVideoPublication({
    workspaceId,
    creativeVersionId: version.id,
    sourceStorageKey,
    sourcePublicUrl,
  });

  const posterArtifacts = [];
  for (const artifact of videoPublication.posterArtifacts ?? []) {
    posterArtifacts.push(await createCreativeArtifact(client, workspaceId, {
      creative_version_id: version.id,
      kind: artifact.kind,
      storage_key: artifact.storageKey,
      public_url: artifact.publicUrl,
      mime_type: artifact.mimeType,
      size_bytes: artifact.sizeBytes,
      checksum: artifact.checksum,
      metadata: artifact.metadata,
    }));
  }

  const renditionArtifacts = [];
  for (const rendition of videoPublication.renditions ?? []) {
    const renditionArtifact = await createCreativeArtifact(client, workspaceId, {
      creative_version_id: version.id,
      kind: rendition.artifact.kind,
      storage_key: rendition.artifact.storageKey,
      public_url: rendition.artifact.publicUrl,
      mime_type: rendition.artifact.mimeType,
      size_bytes: rendition.artifact.sizeBytes,
      checksum: rendition.artifact.checksum,
      metadata: rendition.artifact.metadata,
    });
    renditionArtifacts.push({ rendition, artifact: renditionArtifact });
  }

  for (const entry of renditionArtifacts) {
    const existing = existingByLabel.get(String(entry.rendition.label ?? '').trim().toLowerCase());
    if (existing) {
      await updateVideoRendition(client, workspaceId, existing.id, {
        artifactId: entry.artifact.id,
        label: entry.rendition.label,
        width: entry.rendition.width,
        height: entry.rendition.height,
        bitrateKbps: entry.rendition.bitrateKbps,
        codec: entry.rendition.codec,
        mimeType: entry.rendition.mimeType,
        status: entry.rendition.status,
        isSource: entry.rendition.isSource,
        sortOrder: entry.rendition.sortOrder,
        metadata: entry.rendition.artifact.metadata ?? {},
      });
    } else {
      await createVideoRendition(client, workspaceId, {
        creative_version_id: version.id,
        artifact_id: entry.artifact.id,
        label: entry.rendition.label,
        width: entry.rendition.width,
        height: entry.rendition.height,
        bitrate_kbps: entry.rendition.bitrateKbps,
        codec: entry.rendition.codec,
        mime_type: entry.rendition.mimeType,
        status: entry.rendition.status,
        is_source: entry.rendition.isSource,
        sort_order: entry.rendition.sortOrder,
        metadata: entry.rendition.artifact.metadata ?? {},
      });
    }
  }

  const activeTranscodedRenditions = (videoPublication.renditions ?? []).filter((rendition) => !rendition.isSource);
  const preferredRendition = activeTranscodedRenditions[0] ?? (videoPublication.renditions ?? [])[0] ?? null;
  const posterArtifact = posterArtifacts[0] ?? null;

  const updatedVersion = await updateCreativeVersion(client, workspaceId, version.id, {
    publicUrl: preferredRendition?.artifact.publicUrl ?? version.public_url ?? sourceArtifact.public_url ?? null,
    mimeType: preferredRendition?.mimeType ?? version.mime_type ?? sourceArtifact.mime_type ?? 'video/mp4',
    width: preferredRendition?.width ?? videoPublication.metadata?.width ?? version.width ?? null,
    height: preferredRendition?.height ?? videoPublication.metadata?.height ?? version.height ?? null,
    durationMs: videoPublication.metadata?.durationMs ?? version.duration_ms ?? null,
    metadata: {
      ...(version.metadata ?? {}),
      videoProcessing: videoPublication.processing,
      codec: videoPublication.metadata?.codec ?? null,
      bitRate: videoPublication.metadata?.bitRate ?? null,
      posterGenerated: posterArtifacts.length > 0,
      renditionsGenerated: activeTranscodedRenditions.length,
      renditionsRegeneratedAt: new Date().toISOString(),
    },
  });

  let updatedCreative = creative;
  if (creative) {
    updatedCreative = await updateCreative(client, workspaceId, creative.id, {
      file_url: preferredRendition?.artifact.publicUrl ?? sourceArtifact.public_url ?? creative.file_url ?? null,
      mime_type: preferredRendition?.mimeType ?? sourceArtifact.mime_type ?? creative.mime_type ?? 'video/mp4',
      width: preferredRendition?.width ?? videoPublication.metadata?.width ?? creative.width ?? null,
      height: preferredRendition?.height ?? videoPublication.metadata?.height ?? creative.height ?? null,
      duration_ms: videoPublication.metadata?.durationMs ?? creative.duration_ms ?? null,
      transcode_status: activeTranscodedRenditions.length > 0 ? 'done' : 'failed',
      metadata: {
        ...(creative.metadata ?? {}),
        videoProcessing: videoPublication.processing,
        posterUrl: posterArtifact?.public_url ?? posterArtifact?.publicUrl ?? null,
        codec: videoPublication.metadata?.codec ?? null,
        bitRate: videoPublication.metadata?.bitRate ?? null,
        renditionsGenerated: activeTranscodedRenditions.length,
        renditionsRegeneratedAt: new Date().toISOString(),
      },
    });
  }

  const persistedRenditions = await listVideoRenditions(client, workspaceId, version.id);
  return {
    updatedVersion,
    updatedCreative,
    videoPublication,
    posterArtifacts,
    persistedRenditions,
  };
}
