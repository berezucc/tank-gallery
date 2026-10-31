// R2 helpers for the one-off upload scripts (they are plain .mjs, so they
// cannot import src/lib/r2.ts). Same bucket, same keys, same cache header.

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.R2_BUCKET;

export async function putPhoto(key, body, contentType) {
  await r2.send(new PutObjectCommand({
    Bucket, Key: key, Body: body, ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));
}

// Size of an existing object, or null if it is not there.
export async function photoSize(key) {
  try {
    const head = await r2.send(new HeadObjectCommand({ Bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}
