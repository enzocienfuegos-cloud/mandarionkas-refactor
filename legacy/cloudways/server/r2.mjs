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
let r2 = null;

function requireR2Config() {
  const requiredKeys = [
    ['R2_ACCESS_KEY_ID', env.accessKeyId],
    ['R2_SECRET_ACCESS_KEY', env.secretAccessKey],
    ['R2_BUCKET', env.bucket],
    ['R2_ENDPOINT', env.endpoint],
  ];
  const missing = requiredKeys.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error(`Missing required R2 env vars: ${missing.join(', ')}`);
  }
}

function getR2Client() {
  requireR2Config();
  if (r2) return r2;
  r2 = new S3Client({
    region: 'auto',
    endpoint: env.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
  return r2;
}

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
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: env.bucket,
    Key: storageKey,
    ContentType: mimeType,
  });
  return getSignedUrl(client, command, { expiresIn: env.signedUrlTtlSeconds });
}

export async function objectExists(storageKey) {
  const client = getR2Client();
  try {
    await client.send(new HeadObjectCommand({ Bucket: env.bucket, Key: storageKey }));
    return true;
  } catch {
    return false;
  }
}

export function toPublicAssetUrl(storageKey) {
  if (!env.publicBaseUrl) {
    throw new Error('Missing required env var: R2_PUBLIC_BASE');
  }
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
  const client = getR2Client();
  try {
    const response = await client.send(new GetObjectCommand({
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
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: env.bucket,
    Key: storageKey,
    Body: JSON.stringify(value, null, 2),
    ContentType: 'application/json; charset=utf-8',
  }));
}

export async function deleteObject(storageKey) {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({
    Bucket: env.bucket,
    Key: storageKey,
  }));
}

export async function listObjectKeys(prefix) {
  const client = getR2Client();
  const keys = [];
  let continuationToken = undefined;
  do {
    const response = await client.send(new ListObjectsV2Command({
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
