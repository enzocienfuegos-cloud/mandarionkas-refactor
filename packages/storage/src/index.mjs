/**
 * @smx/storage — File storage adapter
 *
 * Supports two backends, selected via STORAGE_BACKEND env var:
 *   'local'  (default) — stores files under STORAGE_LOCAL_DIR
 *   's3'               — stores files in AWS S3 / compatible (requires AWS_* env vars)
 *
 * API:
 *   import { uploadFile, getFileUrl, deleteFile } from '@smx/storage';
 */

import fs   from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BACKEND   = process.env.STORAGE_BACKEND ?? 'local';
const LOCAL_DIR = process.env.STORAGE_LOCAL_DIR ?? '/tmp/smx-uploads';
const BASE_URL  = process.env.STORAGE_BASE_URL  ?? 'http://localhost:4000/uploads';

// ── Local backend ─────────────────────────────────────────────────────────

async function localUpload(buffer, originalName, contentType) {
  const ext  = path.extname(originalName) || '';
  const key  = `${crypto.randomUUID()}${ext}`;
  const dest = path.join(LOCAL_DIR, key);
  await fs.promises.mkdir(LOCAL_DIR, { recursive: true });
  await fs.promises.writeFile(dest, buffer);
  return key;
}

function localUrl(key) {
  return `${BASE_URL}/${key}`;
}

async function localDelete(key) {
  const dest = path.join(LOCAL_DIR, key);
  await fs.promises.unlink(dest).catch(() => {}); // ignore missing
}

// ── S3 backend ────────────────────────────────────────────────────────────

let s3Client = null;

async function getS3() {
  if (s3Client) return s3Client;
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  s3Client = {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    client: new S3Client({
      region:   process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT, // optional — for S3-compatible services
    }),
    bucket: process.env.S3_BUCKET ?? 'smx-uploads',
  };
  return s3Client;
}

async function s3Upload(buffer, originalName, contentType) {
  const { PutObjectCommand, client, bucket } = await getS3();
  const ext = path.extname(originalName) || '';
  const key = `${crypto.randomUUID()}${ext}`;
  await client.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        buffer,
    ContentType: contentType ?? 'application/octet-stream',
  }));
  return key;
}

function s3Url(key) {
  const bucket = process.env.S3_BUCKET ?? 'smx-uploads';
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const cdn    = process.env.S3_CDN_URL;
  if (cdn) return `${cdn}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function s3Delete(key) {
  const { DeleteObjectCommand, client, bucket } = await getS3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Upload a file buffer and return its storage key.
 *
 * @param {Buffer} buffer
 * @param {string} originalName  - Original filename (used to determine extension)
 * @param {string} [contentType] - MIME type
 * @returns {Promise<string>} storage key
 */
export async function uploadFile(buffer, originalName, contentType) {
  if (BACKEND === 's3') return s3Upload(buffer, originalName, contentType);
  return localUpload(buffer, originalName, contentType);
}

/**
 * Get the public URL for a storage key.
 *
 * @param {string} key
 * @returns {string}
 */
export function getFileUrl(key) {
  if (BACKEND === 's3') return s3Url(key);
  return localUrl(key);
}

/**
 * Delete a file by its storage key.
 *
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deleteFile(key) {
  if (BACKEND === 's3') return s3Delete(key);
  return localDelete(key);
}
