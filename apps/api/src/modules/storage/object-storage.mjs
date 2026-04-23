async function createStorageClient() {
  const endpoint = process.env.R2_ENDPOINT ?? process.env.S3_ENDPOINT;
  const bucket = process.env.R2_BUCKET ?? process.env.S3_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  const { S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

async function createSignedUpload({ key, contentType }) {
  const storage = await createStorageClient();
  if (!storage) return null;

  const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ]);

  return getSignedUrl(storage.client, new PutObjectCommand({
    Bucket: storage.bucket,
    Key: key,
    ContentType: contentType ?? 'application/octet-stream',
  }), { expiresIn: 900 });
}

export async function getObjectBuffer(storageKey) {
  const storage = await createStorageClient();
  if (!storage) return null;

  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const response = await storage.client.send(new GetObjectCommand({
    Bucket: storage.bucket,
    Key: storageKey,
  }));

  if (!response?.Body) return null;
  if (typeof response.Body.transformToByteArray === 'function') {
    return Buffer.from(await response.Body.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function putObjectBuffer({ storageKey, buffer, contentType }) {
  const storage = await createStorageClient();
  if (!storage) return null;

  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  await storage.client.send(new PutObjectCommand({
    Bucket: storage.bucket,
    Key: storageKey,
    Body: buffer,
    ContentType: contentType ?? 'application/octet-stream',
  }));

  return {
    storageKey,
    publicUrl: buildPublicAssetUrl(storageKey) ?? null,
  };
}

export async function prepareObjectUpload({ storageKey, contentType }) {
  const uploadUrl = await createSignedUpload({ key: storageKey, contentType });
  const publicUrl = buildPublicAssetUrl(storageKey);
  return { uploadUrl, publicUrl };
}

export function buildPublicAssetUrl(storageKey) {
  const base = (process.env.ASSETS_PUBLIC_BASE_URL ?? process.env.S3_CDN_URL ?? '').replace(/\/$/, '');
  return base ? `${base}/${storageKey}` : undefined;
}

export function hasUploadStorageConfig() {
  return Boolean(
    (process.env.R2_ENDPOINT ?? process.env.S3_ENDPOINT)
    && (process.env.R2_BUCKET ?? process.env.S3_BUCKET)
    && (process.env.R2_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID)
    && (process.env.R2_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY),
  );
}

export function sanitizeStorageFilename(filename, fallback = 'upload.bin') {
  return String(filename ?? fallback).replace(/[^a-zA-Z0-9._-]/g, '_') || fallback;
}
