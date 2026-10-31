import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Photo bytes live in Cloudflare R2 (10 GB free, no egress fees). Supabase
// still holds the database and auth; its 1 GB storage quota is what pushed the
// images out. Keys are the same `originals/…` / `thumbs/…` paths stored in the
// photos table, so publicPhotoUrl() needs no lookup.
let client: S3Client | null = null;

function r2(): S3Client {
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const bucket = () => process.env.R2_BUCKET!;

export async function putPhoto(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));
}

export async function removePhotos(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await r2().send(new DeleteObjectsCommand({
    Bucket: bucket(),
    Delete: { Objects: keys.map((Key) => ({ Key })) },
  }));
}
