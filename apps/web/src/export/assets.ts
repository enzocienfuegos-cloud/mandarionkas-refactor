import type { PortableExportAsset, PortableExportProject } from './portable';
import type { ExportBundleFile } from './bundle';

export type ExportAssetPlanEntry = {
  id: string;
  widgetId: string;
  kind: PortableExportAsset['kind'];
  sourceUrl: string;
  packagingPath: string;
  fileName: string;
  strategy: 'bundled-copy' | 'inline-data-uri' | 'external-reference';
};

export type ExportRemoteAssetFetchEntry = {
  id: string;
  widgetId: string;
  kind: PortableExportAsset['kind'];
  sourceUrl: string;
  packagingPath: string;
  fileName: string;
};

export type ExportAssetPathMap = Record<string, string>;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeDataUri(sourceUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = sourceUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  if (isBase64) return { mime, bytes: decodeBase64(payload) };
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
}

function normalizeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'asset';
}

function inferExtension(asset: PortableExportAsset, pathname: string): string {
  const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
  if (match) return `.${match[1].toLowerCase()}`;
  switch (asset.kind) {
    case 'image':
      return '.bin';
    case 'video':
      return '.mp4';
    case 'font':
      return '.woff2';
    default:
      return '.bin';
  }
}

function deriveFileName(asset: PortableExportAsset): string {
  try {
    const url = new URL(asset.src);
    const rawName = url.pathname.split('/').filter(Boolean).pop() ?? asset.id;
    const [baseName] = rawName.split('?');
    return normalizeFileName(baseName);
  } catch {
    const extension = inferExtension(asset, asset.src);
    return normalizeFileName(asset.id) + extension;
  }
}

function buildPackagingPath(asset: PortableExportAsset, fileName: string): string {
  return `assets/${asset.kind}/${normalizeFileName(asset.widgetId)}/${fileName}`;
}

export function buildExportAssetPlan(project: PortableExportProject): ExportAssetPlanEntry[] {
  const seen = new Set<string>();
  return project.assets
    .filter((asset) => /^https?:\/\//i.test(asset.src) || asset.src.startsWith('data:'))
    .filter((asset) => {
      const key = `${asset.widgetId}:${asset.src}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((asset) => {
      const fileName = deriveFileName(asset);
      return {
        id: asset.id,
        widgetId: asset.widgetId,
        kind: asset.kind,
        sourceUrl: asset.src,
        fileName,
        packagingPath: buildPackagingPath(asset, fileName),
        strategy: asset.src.startsWith('data:') ? 'inline-data-uri' : 'bundled-copy',
      };
    });
}

export function buildExportAssetPathMap(entries: ExportAssetPlanEntry[]): ExportAssetPathMap {
  return entries.reduce<ExportAssetPathMap>((map, entry) => {
    map[entry.sourceUrl] = entry.strategy === 'external-reference' ? entry.sourceUrl : entry.packagingPath;
    return map;
  }, {});
}

export function buildRemoteAssetFetchPlan(entries: ExportAssetPlanEntry[]): ExportRemoteAssetFetchEntry[] {
  return entries
    .filter((entry) => entry.strategy === 'bundled-copy')
    .map((entry) => ({
      id: entry.id,
      widgetId: entry.widgetId,
      kind: entry.kind,
      sourceUrl: entry.sourceUrl,
      packagingPath: entry.packagingPath,
      fileName: entry.fileName,
    }));
}

function rewriteStringValue(value: string, map: ExportAssetPathMap): string {
  return map[value] ?? value;
}

function rewriteSlides(raw: unknown, map: ExportAssetPathMap): unknown {
  if (typeof raw !== 'string' || raw.trim().length === 0) return raw;
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [src, caption] = item.split('|');
      const nextSrc = rewriteStringValue((src ?? '').trim(), map);
      return caption != null ? `${nextSrc}|${caption}` : nextSrc;
    })
    .join(';');
}

function rewriteWidgetProps(
  props: Record<string, unknown>,
  map: ExportAssetPathMap,
): Record<string, unknown> {
  return {
    ...props,
    src: typeof props.src === 'string' ? rewriteStringValue(props.src, map) : props.src,
    posterSrc: typeof props.posterSrc === 'string' ? rewriteStringValue(props.posterSrc, map) : props.posterSrc,
    imageSrc: typeof props.imageSrc === 'string' ? rewriteStringValue(props.imageSrc, map) : props.imageSrc,
    backgroundImage: typeof props.backgroundImage === 'string' ? rewriteStringValue(props.backgroundImage, map) : props.backgroundImage,
    beforeSrc: typeof props.beforeSrc === 'string' ? rewriteStringValue(props.beforeSrc, map) : props.beforeSrc,
    afterSrc: typeof props.afterSrc === 'string' ? rewriteStringValue(props.afterSrc, map) : props.afterSrc,
    beforeImage: typeof props.beforeImage === 'string' ? rewriteStringValue(props.beforeImage, map) : props.beforeImage,
    afterImage: typeof props.afterImage === 'string' ? rewriteStringValue(props.afterImage, map) : props.afterImage,
    slides: rewriteSlides(props.slides, map),
  };
}

export function buildLocalizedPortableProject(
  project: PortableExportProject,
  entries: ExportAssetPlanEntry[],
): PortableExportProject {
  const map = buildExportAssetPathMap(entries);
  return {
    ...project,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      widgets: scene.widgets.map((widget) => ({
        ...widget,
        props: rewriteWidgetProps(widget.props, map),
        assetRefs: widget.assetRefs.map((asset) => ({
          ...asset,
          src: rewriteStringValue(asset.src, map),
        })),
      })),
    })),
    assets: project.assets.map((asset) => ({
      ...asset,
      src: rewriteStringValue(asset.src, map),
    })),
  };
}

export function materializeExportAssetFiles(entries: ExportAssetPlanEntry[]): ExportBundleFile[] {
  return entries.flatMap((entry) => {
    if (entry.strategy !== 'inline-data-uri') return [];
    const decoded = decodeDataUri(entry.sourceUrl);
    if (!decoded) return [];
    return [{
      path: entry.packagingPath,
      mime: decoded.mime,
      bytes: decoded.bytes,
    }];
  });
}

export async function materializeRemoteExportAssetFiles(
  entries: ExportAssetPlanEntry[],
  fetchImpl: typeof fetch = fetch,
): Promise<ExportBundleFile[]> {
  const materialized = await Promise.all(entries.map(async (entry) => {
    if (entry.strategy !== 'bundled-copy') return null;
    try {
      const response = await fetchImpl(entry.sourceUrl);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const mime = response.headers.get('content-type') || 'application/octet-stream';
      return {
        path: entry.packagingPath,
        mime,
        bytes: new Uint8Array(buffer),
      } satisfies ExportBundleFile;
    } catch {
      return null;
    }
  }));

  return materialized.filter((file): file is ExportBundleFile => Boolean(file));
}
