import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerEnv } from './env.mjs';

const env = getServerEnv();

const r2 = new S3Client({
  region: 'auto',
  endpoint: env.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
  },
});

function sanitizeFileName(filename = 'asset') {
  return String(filename)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'asset';
}

export function detectAssetKind(mimeType = '', filename = '') {
  const mime = String(mimeType).toLowerCase();
  const name = String(filename).toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(name)) return 'video';
  if (mime.startsWith('font/') || /\.(woff2?|ttf|otf)$/i.test(name)) return 'font';
  return 'other';
}

export function buildStorageKey({ assetId, clientId = 'client_default', filename = 'asset' }) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `workspaces/${clientId}/assets/${yyyy}/${mm}/${assetId}/${sanitizeFileName(filename)}`;
}

export async function createUploadUrl({ storageKey, mimeType }) {
  const command = new PutObjectCommand({
    Bucket: env.bucket,
    Key: storageKey,
    ContentType: mimeType,
  });
  return getSignedUrl(r2, command, { expiresIn: env.signedUrlTtlSeconds });
}

export async function objectExists(storageKey) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: env.bucket, Key: storageKey }));
    return true;
  } catch {
    return false;
  }
}

export function toPublicAssetUrl(storageKey) {
  return `${env.publicBaseUrl.replace(/\/$/, '')}/${String(storageKey).replace(/^\//, '')}`;
}

function isMissingObjectError(error) {
  const metadataStatus = error?.$metadata?.httpStatusCode;
  return (
    metadataStatus === 404 ||
    error?.name === 'NoSuchKey' ||
    error?.name === 'NotFound' ||
    error?.Code === 'NoSuchKey'
  );
}

export async function readJsonObject(storageKey) {
  try {
    const response = await r2.send(new GetObjectCommand({
      Bucket: env.bucket,
      Key: storageKey,
    }));
    const raw = await response.Body?.transformToString('utf8');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}

export async function writeJsonObject(storageKey, value) {
  await r2.send(new PutObjectCommand({
    Bucket: env.bucket,
    Key: storageKey,
    Body: JSON.stringify(value, null, 2),
    ContentType: 'application/json; charset=utf-8',
  }));
}

export async function deleteObject(storageKey) {
  await r2.send(new DeleteObjectCommand({
    Bucket: env.bucket,
    Key: storageKey,
  }));
}

export async function listObjectKeys(prefix) {
  const keys = [];
  let continuationToken = undefined;
  do {
    const response = await r2.send(new ListObjectsV2Command({
      Bucket: env.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const item of response.Contents ?? []) {
      if (item.Key) keys.push(item.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}
