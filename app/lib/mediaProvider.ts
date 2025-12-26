import { getSupabaseBrowserClient } from './supabaseClient';

export type MediaKind = 'image' | 'video' | 'audio';

export type MediaUploadResult = {
  url: string;
  mimeType: string;
  size: number;
  filename: string;
};

const MEDIA_PROVIDER = (process.env.NEXT_PUBLIC_MEDIA_PROVIDER || 'supabase').toLowerCase();
const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_MEDIA_BUCKET || 'media';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days for signed URL fallback

const buildObjectPath = (kind: MediaKind, filename: string) => {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = safeName.includes('.') ? safeName.split('.').pop() : 'bin';
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString();
  return `${kind}/${unique}.${ext}`;
};

const uploadWithSupabase = async (file: File, kind: MediaKind): Promise<MediaUploadResult> => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const objectPath = buildObjectPath(kind, file.name);
  const bucket = DEFAULT_BUCKET;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    throw new Error(uploadError.message || 'Unable to upload file.');
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  let url = publicData?.publicUrl || '';
  let signedError: Error | undefined;

  if (!url) {
    const { data: signedData, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
    url = signedData?.signedUrl || '';
    signedError = error ? new Error(error.message) : undefined;
  }

  if (!url) {
    throw signedError || new Error('Could not generate a URL for the uploaded media.');
  }

  return {
    url,
    mimeType: file.type,
    size: file.size,
    filename: file.name,
  };
};

export const uploadMedia = async (file: File, kind: MediaKind): Promise<MediaUploadResult> => {
  switch (MEDIA_PROVIDER) {
    case 'supabase':
      return uploadWithSupabase(file, kind);
    default:
      throw new Error(`Unsupported media provider: ${MEDIA_PROVIDER}`);
  }
};

