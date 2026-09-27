import {
  CreateBucketCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';

dotenv.config();

const {
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
  S3_REGION = 'ca-central-1',
  S3_BUCKET = 'property-images',
  SUPABASE_URL,
} = process.env;

function required(name, value) {
  if (!value) throw new Error(`Missing ${name} in backend/.env`);
  return value;
}

export const storageConfig = {
  bucket: S3_BUCKET,
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  publicBase: SUPABASE_URL
    ? `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${S3_BUCKET}`
    : null,
};

export function createS3Client() {
  return new S3Client({
    forcePathStyle: true,
    region: required('S3_REGION', S3_REGION),
    endpoint: required('S3_ENDPOINT', S3_ENDPOINT),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID', S3_ACCESS_KEY_ID),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY', S3_SECRET_ACCESS_KEY),
    },
  });
}

async function ensurePublicViaSupabaseApi(bucket) {
  const listed = await supabase.storage.listBuckets();
  if (listed.error) throw listed.error;

  const existing = (listed.data || []).find((item) => item.name === bucket);
  if (!existing) {
    const created = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    if (created.error && !/already exists/i.test(created.error.message || '')) {
      throw created.error;
    }
  } else if (!existing.public) {
    const updated = await supabase.storage.updateBucket(bucket, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    if (updated.error) throw updated.error;
  }
}

export async function ensurePropertyImagesBucket(client = createS3Client()) {
  const bucket = storageConfig.bucket;
  let created = false;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const missing = status === 404 || error?.name === 'NotFound' || error?.Code === 'NoSuchBucket';
    if (!missing) throw error;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    created = true;
  }

  try {
    await ensurePublicViaSupabaseApi(bucket);
  } catch (error) {
    console.warn('[storage] Could not mark bucket public via Supabase API:', error.message);
  }

  return { bucket, created };
}

export async function verifyStorageConnection() {
  const client = createS3Client();
  const listed = await client.send(new ListBucketsCommand({}));
  const ensured = await ensurePropertyImagesBucket(client);
  return {
    ok: true,
    buckets: (listed.Buckets || []).map((b) => b.Name),
    propertyImages: ensured,
    endpoint: storageConfig.endpoint,
    region: storageConfig.region,
  };
}

export function publicObjectUrl(objectKey) {
  if (!storageConfig.publicBase) {
    throw new Error('SUPABASE_URL is required to build public object URLs');
  }
  return `${storageConfig.publicBase}/${objectKey.replace(/^\//, '')}`;
}

export async function uploadPropertyImage({ buffer, contentType, filename, propertyId }) {
  const client = createS3Client();
  await ensurePropertyImagesBucket(client);

  const safeName = String(filename || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'image';
  const ext = safeName.includes('.') ? '' : guessExtension(contentType);
  const key = `properties/${propertyId || 'new'}/${Date.now()}-${safeName}${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: storageConfig.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return {
    key,
    bucket: storageConfig.bucket,
    image_url: publicObjectUrl(key),
  };
}

function guessExtension(contentType = '') {
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  return '';
}
