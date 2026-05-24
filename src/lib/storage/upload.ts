import "server-only";
import { db, schema } from "@/lib/db/client";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/current-user";
import { and, eq } from "drizzle-orm";

type Bucket = "properties" | "receipts";

/**
 * Upload a file to Supabase Storage and record an `attachments` row.
 * Path convention: {userId}/{relatedId}/{filename}.
 */
export async function uploadAttachment(input: {
  bucket: Bucket;
  relatedTable: "properties" | "transactions";
  relatedId: string;
  file: File;
}) {
  const profile = await requireProfile();
  const supabase = await createServerSupabase();

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${profile.id}/${input.relatedId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(input.bucket)
    .upload(path, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || "application/octet-stream",
    });
  if (error) throw error;

  await db.insert(schema.attachments).values({
    userId: profile.id,
    relatedTable: input.relatedTable,
    relatedId: input.relatedId,
    storageBucket: input.bucket,
    storagePath: path,
    filename: safeName,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size,
  });

  return { path };
}

export async function getSignedUrl(bucket: Bucket, path: string, expiresInSec = 3600) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(id: string) {
  const profile = await requireProfile();
  const supabase = await createServerSupabase();
  const [att] = await db
    .select()
    .from(schema.attachments)
    .where(and(eq(schema.attachments.id, id), eq(schema.attachments.userId, profile.id)))
    .limit(1);
  if (!att) return;
  await supabase.storage.from(att.storageBucket).remove([att.storagePath]);
  await db
    .delete(schema.attachments)
    .where(and(eq(schema.attachments.id, id), eq(schema.attachments.userId, profile.id)));
}
