import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export function createR2Client(config = {}) {
  const { endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl } = config;
  const isConfigured = Boolean(endpoint && bucket && accessKeyId && secretAccessKey);

  if (!isConfigured) {
    return createNullClient(publicBaseUrl);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const normalizedPublicBase = String(publicBaseUrl || '').trim().replace(/\/+$/, '');

  return {
    isConfigured: true,

    async putXml(storageKey, xml, opts = {}) {
      const body = Buffer.from(xml, 'utf8');
      const metadata = {};
      if (opts.etag) metadata['smx-etag'] = opts.etag;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: body,
          ContentType: opts.contentType || 'application/xml; charset=utf-8',
          ContentLength: body.length,
          CacheControl: opts.cacheControl || 'public, max-age=300',
          Metadata: metadata,
        }),
      );

      return {
        storageKey,
        publicUrl: toPublicUrl(normalizedPublicBase, storageKey),
        contentLength: body.length,
      };
    },

    async exists(storageKey) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
        return true;
      } catch {
        return false;
      }
    },

    async delete(storageKey) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    },

    toPublicUrl(storageKey) {
      return toPublicUrl(normalizedPublicBase, storageKey);
    },
  };
}

export function buildVastStorageKey(tagId, profile) {
  if (!tagId || !profile) throw new Error('tagId and profile are required to build a VAST storage key.');
  return `vast/tags/${tagId}/${profile}.xml`;
}

function createNullClient(publicBaseUrl) {
  const normalizedPublicBase = String(publicBaseUrl || '').trim().replace(/\/+$/, '');
  return {
    isConfigured: false,
    async putXml(storageKey) {
      warnNotConfigured('putXml', storageKey);
      return {
        storageKey,
        publicUrl: toPublicUrl(normalizedPublicBase, storageKey),
        contentLength: 0,
      };
    },
    async exists() {
      return false;
    },
    async delete(storageKey) {
      warnNotConfigured('delete', storageKey);
    },
    toPublicUrl(storageKey) {
      return toPublicUrl(normalizedPublicBase, storageKey);
    },
  };
}

function warnNotConfigured(fn, storageKey = '') {
  console.warn(
    JSON.stringify({
      level: 'warn',
      time: new Date().toISOString(),
      service: 'smx-r2',
      fn,
      storageKey,
      message: 'R2 client is not configured — write skipped. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.',
    }),
  );
}

function toPublicUrl(base, storageKey) {
  if (!base) return `/${String(storageKey).replace(/^\//, '')}`;
  return `${base}/${String(storageKey).replace(/^\//, '')}`;
}
