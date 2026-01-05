import { getSupabaseBrowserClient } from './supabaseClient';

export type MediaKind = 'image' | 'video' | 'audio';

export type MediaUploadResult = {
  url: string;
  mimeType: string;
  size: number;
  filename: string;
  storagePath: string;
};

export type MediaUploadOptions = {
  /**
   * When provided, media is stored under posts/{postId}/{filename}
   * to keep objects grouped by post.
   */
  postId?: string;
  /**
   * Optional override for the storage bucket. Defaults to NEXT_PUBLIC_MEDIA_BUCKET or "media".
   */
  bucket?: string;
  /**
   * When false, prefers public URLs; otherwise signed URLs are generated.
   */
  preferSignedUrl?: boolean;
};

export const MEDIA_PROVIDER = (process.env.NEXT_PUBLIC_MEDIA_PROVIDER || 'supabase').toLowerCase();
export const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_MEDIA_BUCKET || 'media';
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days for signed URL fallback

const sanitizeFilename = (filename: string) => filename.replace(/[^a-zA-Z0-9._-]/g, '_');

const buildObjectPath = (kind: MediaKind, filename: string) => {
  const safeName = sanitizeFilename(filename);
  const ext = safeName.includes('.') ? safeName.split('.').pop() : 'bin';
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString();
  return `${kind}/${unique}.${ext}`;
};

export const buildPostObjectPath = (postId: string, filename: string) => {
  const safeName = sanitizeFilename(filename);
  const ext = safeName.includes('.') ? `.${safeName.split('.').pop()}` : '';
  const nameWithoutExt = safeName.replace(/\.[^.]+$/, '');
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString();
  return `posts/${postId}/${nameWithoutExt}-${unique}${ext || '.bin'}`;
};

const buildUrlForPath = async (
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  bucket: string,
  objectPath: string,
  preferSignedUrl = true,
  expiresIn = SIGNED_URL_TTL_SECONDS,
) => {
  if (!supabase) return objectPath;

  if (preferSignedUrl) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (publicData?.publicUrl) return publicData.publicUrl;

  // Fallback to the storage path when URL generation fails.
  return objectPath;
};

export const resolvePathsToSignedUrls = async (
  paths: string[],
  options?: { bucket?: string; expiresIn?: number; preferSignedUrl?: boolean },
) => {
  const supabase = getSupabaseBrowserClient();
  const bucket = options?.bucket || DEFAULT_BUCKET;
  const preferSignedUrl = options?.preferSignedUrl ?? true;
  const expiresIn = options?.expiresIn ?? SIGNED_URL_TTL_SECONDS;

  if (!supabase || paths.length === 0) {
    return new Map<string, string>();
  }

  // createSignedUrls performs a batched signed URL generation.
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  const result = new Map<string, string>();

  if (!error && data) {
    data.forEach((item, idx) => {
      const path = paths[idx];
      if (item?.signedUrl) {
        result.set(path, item.signedUrl);
      }
    });
  }

  // Fill in any gaps with individual fallbacks.
  await Promise.all(
    paths.map(async (p) => {
      if (result.has(p)) return;
      const url = await buildUrlForPath(supabase, bucket, p, preferSignedUrl, expiresIn);
      result.set(p, url);
    }),
  );

  return result;
};

const uploadWithSupabase = async (file: File, kind: MediaKind, options?: MediaUploadOptions): Promise<MediaUploadResult> => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const bucket = options?.bucket || DEFAULT_BUCKET;
  const objectPath = options?.postId ? buildPostObjectPath(options.postId, file.name) : buildObjectPath(kind, file.name);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    throw new Error(uploadError.message || 'Unable to upload file.');
  }

  const url = await buildUrlForPath(supabase, bucket, objectPath, options?.preferSignedUrl ?? true);
  if (!url) {
    throw new Error('Could not generate a URL for the uploaded media.');
  }

  return {
    url,
    mimeType: file.type,
    size: file.size,
    filename: file.name,
    storagePath: objectPath,
  };
};

export const uploadMedia = async (file: File, kind: MediaKind, options?: MediaUploadOptions): Promise<MediaUploadResult> => {
  switch (MEDIA_PROVIDER) {
    case 'supabase':
      return uploadWithSupabase(file, kind, options);
    default:
      throw new Error(`Unsupported media provider: ${MEDIA_PROVIDER}`);
  }
};

