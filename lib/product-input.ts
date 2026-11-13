import { z } from 'zod';
import { SECTIONS } from '@/lib/constants';
import { articleReferencesSchema } from '@/lib/article-references';

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const httpUrl = z.string().trim().max(2048).refine(isHttpUrl);
const muxId = z.string().trim().regex(/^[A-Za-z0-9]{1,128}$/);

// Mirrors the admin form; unknown keys (id, status, ...) are stripped.
const shape = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  fullDescription: z.string().max(50_000).optional(),
  images: z.array(httpUrl).max(50),
  video: httpUrl.optional(),
  muxAssetId: muxId.optional(),
  muxPlaybackId: muxId.optional(),
  videos: z
    .array(z.object({ video: httpUrl.optional(), muxAssetId: muxId.optional(), muxPlaybackId: muxId.optional() }))
    .max(20)
    .optional(),
  teamMembers: z.string().trim().max(1000).optional(),
  references: articleReferencesSchema.optional(),
  section: z.string().refine((name) => SECTIONS.some((section) => section.name === name)),
};

export const productInputSchema = z.object({ ...shape, images: shape.images.default([]) });

// PATCH: only sent keys change; null removes an optional key. Required keys cannot be null.
const nullable = {
  fullDescription: shape.fullDescription.nullable(),
  video: shape.video.nullable(),
  muxAssetId: shape.muxAssetId.nullable(),
  muxPlaybackId: shape.muxPlaybackId.nullable(),
  videos: shape.videos.nullable(),
  teamMembers: shape.teamMembers.nullable(),
  references: shape.references.nullable(),
};
export const productPatchSchema = z.object({
  revision: z.string().regex(/^[0-9a-f]{64}$/),
  changes: z
    .object({ ...shape, ...nullable })
    .partial()
    .refine((changes) => Object.values(changes).some((value) => value !== undefined)),
});

export async function readProductInput(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_048_576) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
