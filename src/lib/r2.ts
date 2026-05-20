import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";

function localRoot() {
  return path.join(process.cwd(), ".local-object-storage");
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

function getS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const endpoint =
    process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

async function readStreamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Empty object body");
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported stream body");
}

export function buildObjectKey(input: {
  batchYear: number;
  semester: number;
  folder: string;
  originalName: string;
}) {
  const safe = input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `batches/${input.batchYear}/sem-${input.semester}/${input.folder}/${Date.now()}-${safe}`;
}

export async function putObjectBytes(key: string, body: Buffer, contentType: string) {
  if (isR2Configured()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  const fullPath = path.join(localRoot(), key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
  return key;
}

export async function getObjectBytes(key: string): Promise<{ buffer: Buffer; contentType?: string }> {
  if (isR2Configured()) {
    const client = getS3Client();
    const result = await client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
      }),
    );
    const buffer = await readStreamToBuffer(result.Body);
    return { buffer, contentType: result.ContentType ?? undefined };
  }

  const fullPath = path.join(localRoot(), key);
  const buffer = await fs.readFile(fullPath);
  return { buffer };
}

export async function deleteObjectBytes(key: string) {
  if (isR2Configured()) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
      }),
    );
    return;
  }

  const fullPath = path.join(localRoot(), key);
  try {
    await fs.unlink(fullPath);
  } catch {
    // File may already be gone.
  }
}
