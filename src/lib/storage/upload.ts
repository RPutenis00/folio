import "server-only";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/current-user";

type Bucket = "properties" | "receipts";

const STORAGE_ROOT = resolve(process.cwd(), process.env.STORAGE_PATH ?? "./.data/storage");

function pathFor(bucket: Bucket, userId: string, relatedId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(bucket, userId, relatedId, `${Date.now()}-${safeName}`);
}

export async function uploadAttachment(input: {
  bucket: Bucket;
  relatedTable: "properties" | "transactions";
  relatedId: string;
  file: File;
}) {
  const profile = await requireProfile();
  const relPath = pathFor(input.bucket, profile.id, input.relatedId, input.file.name);
  const absPath = join(STORAGE_ROOT, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  const buf = Buffer.from(await input.file.arrayBuffer());
  writeFileSync(absPath, buf);

  await db.insert(schema.attachments).values({
    id: randomUUID(),
    userId: profile.id,
    relatedTable: input.relatedTable,
    relatedId: input.relatedId,
    storageBucket: input.bucket,
    storagePath: relPath,
    filename: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size,
  });

  return { path: relPath };
}

export async function getSignedUrl(bucket: Bucket, path: string, _expiresInSec = 3600) {
  // Local FS: serve via a route handler at /api/files/[bucket]/[...path] if needed.
  return `/api/files/${bucket}/${path}`;
}

export async function deleteAttachment(id: string) {
  const profile = await requireProfile();
  const [att] = await db
    .select()
    .from(schema.attachments)
    .where(and(eq(schema.attachments.id, id), eq(schema.attachments.userId, profile.id)))
    .limit(1);
  if (!att) return;
  const abs = join(STORAGE_ROOT, att.storagePath);
  if (existsSync(abs)) unlinkSync(abs);
  await db
    .delete(schema.attachments)
    .where(and(eq(schema.attachments.id, id), eq(schema.attachments.userId, profile.id)));
}
