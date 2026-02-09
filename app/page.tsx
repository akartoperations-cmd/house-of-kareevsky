'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  audioItems,
  emojis,
  fakeComments,
  messages,
  photos,
  type Comment,
  type Message,
  type Photo,
  type PersonalMessage,
  type I18nLang,
  type I18nMode,
  type I18nItem,
  type I18nPack,
} from './lib/intimateMockData';
import { AuthBar } from './components/AuthBar';
import { getSupabaseBrowserClient } from './lib/supabaseClient';
import {
  DEFAULT_BUCKET as MEDIA_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  resolvePathsToSignedUrls,
  uploadMedia,
  type MediaKind,
  type MediaUploadResult,
} from './lib/mediaProvider';
import { useAccessRedirect } from './lib/useAccessRedirect';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
  }
}

type PushEventPayload = {
  eventType: 'admin_new_post' | 'admin_dm_to_user' | 'user_dm_to_admin' | 'new_comment_to_admin';
  postId?: string;
  toUserId?: string | null;
  messageText?: string;
  commentText?: string;
  deepLink?: string;
};

type AdminMessage = {
  id: string;
  author: 'Kareevsky';
  time: string;
  date?: string;
  createdAt?: string;
  text: string;
  isUnread: boolean;
};

type View = 'home' | 'gallery' | 'audio' | 'write' | 'treat' | 'personal' | 'create' | 'saved';
type ReactionsMap = Record<string, string>;
type BookmarksMap = Record<string, boolean>;
type PhotoViewerData = {
  images: string[];
  index: number;
  description?: string;
  date?: string;
  time?: string;
  source: 'photoOfDay' | 'post';
};
type PhotoViewerState = PhotoViewerData | null;
type AdminInboxState = { hasUnread: boolean; count: number };
type GalleryTab = 'photoOfDay' | 'posts';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const parseDate = (value?: string) => {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const isSameDay = (a?: string, b?: string) => {
  const d1 = parseDate(a);
  const d2 = parseDate(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatDayLabel = (value?: string) => {
  const d = parseDate(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
};

const isStandaloneDisplay = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

const isIosSafari = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios/i.test(ua) && !/fxios/i.test(ua) && !/edgios/i.test(ua);
  return isIOS && isSafari;
};

// Format date for showing alongside time in message meta (e.g. "Dec 12")
const formatShortDate = (value?: string) => {
  const d = parseDate(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d);
};

const formatShortTime = (value?: string) => {
  const d = parseDate(value);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

const URL_REGEX = /((https?:\/\/[^\s]+)|(www\.[^\s]+))/gi;

const linkifyTextNodes = (text: string): Array<string | JSX.Element> => {
  if (!text) return [''];

  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;

  text.replace(URL_REGEX, (match, _full, _httpMatch, _wwwMatch, offset) => {
    if (typeof offset !== 'number') return match;
    if (offset > lastIndex) {
      nodes.push(text.slice(lastIndex, offset));
    }

    const href = match.startsWith('www.') ? `https://${match}` : match;
    nodes.push(
      <a key={`link-${offset}-${match}`} href={href} target="_blank" rel="noopener noreferrer">
        {match}
      </a>,
    );

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : [text];
};

const renderLinkifiedText = (text?: string | null) => linkifyTextNodes(text || '');

type PostMediaRow = {
  id: string;
  post_id?: string | null;
  storage_path: string;
  media_type: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  created_at?: string | null;
};

type CommentRow = {
  id: string;
  post_id?: string | null;
  user_id?: string | null;
  body_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean | null;
};

type DirectMessageRow = {
  id: string;
  thread_id?: string | null;
  from_user_id?: string | null;
  to_admin_id?: string | null;
  body_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean | null;
};

type PostRow = {
  id: string;
  author_id?: string | null;
  type: string;
  title?: string | null;
  body_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean | null;
  visibility?: string | null;
  metadata?: Record<string, unknown> | null;
  post_media?: PostMediaRow[] | null;
  comments?: CommentRow[] | null;
};

type PostMediaWithUrl = PostMediaRow & { url?: string };

type PollOptionRow = {
  id: string;
  poll_id?: string | null;
  option_text?: string | null;
  poll_votes?: { count: number | null }[] | null;
};

type PollRow = {
  id: string;
  post_id?: string | null;
  question?: string | null;
  poll_options?: PollOptionRow[] | null;
};

type PollOptionStats = { id: string; text: string; votes: number };
type PollMessageData = {
  pollId: string;
  question: string;
  options: PollOptionStats[];
  totalVotes: number;
  userVoteOptionId: string | null;
};
type PollDataByPostId = Record<string, PollMessageData>;

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || null;

type PhotoOfDayRow = {
  id: string;
  created_at: string;
  image_path: string;
  caption: string | null;
  created_by: string | null;
};

type PhotoOfDayItem = Photo & {
  createdAt: string;
  imagePath?: string;
};

const PHOTO_OF_DAY_TABLE = 'photo_of_day';
const PHOTO_OF_DAY_CACHE_KEYS = {
  id: 'last_photo_id',
  createdAt: 'last_created_at',
  imagePath: 'last_image_path',
  caption: 'last_caption',
  imageUrl: 'last_image_url', // optional helper for instant display
} as const;

const isProbablyUrl = (value: string) => /^https?:\/\//i.test(value);

const toErrorMeta = (err: unknown): { code?: string; message?: string; statusCode?: number } => {
  const anyErr = (err || {}) as { code?: string; message?: string; statusCode?: number; error_description?: string };
  return {
    code: anyErr.code,
    message: anyErr.message || anyErr.error_description,
    statusCode: anyErr.statusCode,
  };
};

const readPhotoOfDayCache = (): PhotoOfDayItem | null => {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.localStorage.getItem(PHOTO_OF_DAY_CACHE_KEYS.id) || '';
    const createdAt = window.localStorage.getItem(PHOTO_OF_DAY_CACHE_KEYS.createdAt) || '';
    const imagePath = window.localStorage.getItem(PHOTO_OF_DAY_CACHE_KEYS.imagePath) || '';
    const caption = window.localStorage.getItem(PHOTO_OF_DAY_CACHE_KEYS.caption) || '';
    const cachedUrl = window.localStorage.getItem(PHOTO_OF_DAY_CACHE_KEYS.imageUrl) || '';

    if (!id || !createdAt) return null;
    const url = cachedUrl || (isProbablyUrl(imagePath) ? imagePath : '');
    if (!url) return null;

    return {
      id,
      url,
      date: formatShortDate(createdAt),
      time: formatShortTime(createdAt),
      description: caption || '',
      createdAt,
      imagePath: isProbablyUrl(imagePath) ? undefined : imagePath,
    };
  } catch {
    return null;
  }
};

const writePhotoOfDayCache = (item: PhotoOfDayItem) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PHOTO_OF_DAY_CACHE_KEYS.id, item.id);
    window.localStorage.setItem(PHOTO_OF_DAY_CACHE_KEYS.createdAt, item.createdAt);
    window.localStorage.setItem(PHOTO_OF_DAY_CACHE_KEYS.imagePath, item.imagePath || item.url);
    window.localStorage.setItem(PHOTO_OF_DAY_CACHE_KEYS.caption, item.description || '');
    if (item.url) {
      window.localStorage.setItem(PHOTO_OF_DAY_CACHE_KEYS.imageUrl, item.url);
    }
  } catch {
    // ignore cache write failures
  }
};

type FeedCacheV1 = {
  v: 1;
  savedAt: string;
  messages: Message[];
  commentsByPostId: Record<string, Comment[]>;
  pagesLoaded: number;
  hasMoreOlder: boolean;
  oldestCursor: string | null;
};

const FEED_CACHE_KEY = 'feed_cache_v1';

const readFeedCache = (): FeedCacheV1 | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedCacheV1;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeFeedCache = (value: FeedCacheV1) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore cache write failures
  }
};

type SupabaseError = { code?: string; message?: string; details?: string; hint?: string };

const friendlySupabaseError = (err: unknown): string => {
  const supa = (err || {}) as SupabaseError;
  const code = supa.code || '';
  const message = (supa.message || '').toLowerCase();

  if (code === '42501' || message.includes('row-level security') || message.includes('permission')) {
    return 'You do not have permission to do that. Please sign in again.';
  }

  if (code === '42P01' || message.includes('relation') || message.includes('table')) {
    return 'Database table is not available yet. Please retry after a refresh.';
  }

  if (message.includes('duplicate') || code === '23505') {
    return 'This item already exists.';
  }

  return supa.message || 'Unexpected error occurred.';
};

const triggerPushEvent = async (payload: PushEventPayload) => {
  try {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[push] Failed to trigger push event', err);
    }
  }
};

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function useElementVisibleOnce<T extends Element>(options?: IntersectionObserverInit & { rootMargin?: string }) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      {
        root: options?.root ?? null,
        rootMargin: options?.rootMargin ?? '600px 0px',
        threshold: options?.threshold ?? 0.01,
      },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [options?.root, options?.rootMargin, options?.threshold, visible]);

  return { ref, visible };
}

const readImageDimensions = (file: File): Promise<{ width?: number; height?: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width || undefined, height: img.naturalHeight || img.height || undefined });
      cleanup();
    };
    img.onerror = () => {
      resolve({});
      cleanup();
    };
    img.src = objectUrl;
  });

const createImagePreviewFile = async (file: File, options?: { maxSize?: number; quality?: number }) => {
  const maxSize = options?.maxSize ?? 900;
  const quality = options?.quality ?? 0.78;
  if (typeof document === 'undefined') return null;
  if (!file.type.startsWith('image/')) return null;

  try {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('preview image load failed'));
      img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const w = img.naturalWidth || 0;
    const h = img.naturalHeight || 0;
    if (!w || !h) return null;

    const scale = Math.min(1, maxSize / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );
    if (!blob) return null;

    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${name}-preview.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
};

const createVideoPosterFromMiddle = async (file: File, options?: { quality?: number }) => {
  const quality = options?.quality ?? 0.82;
  if (typeof document === 'undefined') return null;
  if (!file.type.startsWith('video/')) return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('video metadata failed'));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targetTime = duration > 0 ? Math.max(0, Math.min(duration - 0.1, duration * 0.5)) : 0;

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const seekTo = () => {
        try {
          video.currentTime = targetTime;
        } catch {
          done();
        }
      };
      video.onseeked = () => done();
      // Some browsers need a play/pause cycle to allow seeking.
      video.onloadeddata = () => seekTo();
      seekTo();
      setTimeout(done, 1200);
    });

    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (!w || !h) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );
    if (!blob) return null;

    return new File([blob], 'video-poster.jpg', { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const readVideoMetadata = (file: File): Promise<{ width?: number; height?: number; duration?: number }> =>
  new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      video.src = '';
      URL.revokeObjectURL(objectUrl);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : undefined;
      resolve({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration,
      });
      cleanup();
    };
    video.onerror = () => {
      resolve({});
      cleanup();
    };
    video.src = objectUrl;
  });

const readAudioMetadata = (file: File): Promise<{ duration?: number }> =>
  new Promise((resolve) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      audio.src = '';
      URL.revokeObjectURL(objectUrl);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      resolve({ duration: Number.isFinite(audio.duration) ? audio.duration : undefined });
      cleanup();
    };
    audio.onerror = () => {
      resolve({});
      cleanup();
    };
    audio.src = objectUrl;
  });

const extractMediaMetadata = async (
  file: File,
  mediaType: MediaKind,
): Promise<{ width?: number | null; height?: number | null; duration?: number | null }> => {
  try {
    if (mediaType === 'image') {
      const { width, height } = await readImageDimensions(file);
      return { width: width ?? null, height: height ?? null, duration: null };
    }
    if (mediaType === 'video') {
      const { width, height, duration } = await readVideoMetadata(file);
      return {
        width: width ?? null,
        height: height ?? null,
        duration: duration ?? null,
      };
    }
    if (mediaType === 'audio') {
      const { duration } = await readAudioMetadata(file);
      return { width: null, height: null, duration: duration ?? null };
    }
  } catch {
    // best-effort; swallow errors and return empty metadata
  }
  return { width: null, height: null, duration: null };
};

const resolveMediaWithUrls = async (media: PostMediaRow[] | null | undefined): Promise<PostMediaWithUrl[]> => {
  const items = (media || []).filter(Boolean);
  if (!items.length) return [];
  const uniquePaths = Array.from(new Set(items.map((m) => m.storage_path)));
  const urlMap = await resolvePathsToSignedUrls(uniquePaths, { bucket: MEDIA_BUCKET });
  return items.map((m) => ({
    ...m,
    url: urlMap.get(m.storage_path) || m.storage_path,
  }));
};

const resolveMediaForRows = async (rows: PostRow[]): Promise<PostRow[]> => {
  const allMedia = rows.flatMap((row) => row.post_media || []);
  const uniquePaths = Array.from(new Set(allMedia.map((m) => m.storage_path)));
  
  console.log('[resolveMediaForRows] Resolving URLs for paths:', uniquePaths);
  const urlMap = await resolvePathsToSignedUrls(uniquePaths, { bucket: MEDIA_BUCKET });
  console.log('[resolveMediaForRows] URL map result:', Object.fromEntries(urlMap));

  return rows.map((row) => ({
    ...row,
    post_media: (row.post_media || []).map((m) => ({
      ...m,
      url: urlMap.get(m.storage_path) || m.storage_path,
    })),
  }));
};

const cleanupPostAndMedia = async (postId: string | null, storagePaths: string[]) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  try {
    if (postId) {
      await supabase.from('post_media').delete().eq('post_id', postId);
      await supabase.from('posts').delete().eq('id', postId);
    }
  } catch {
    // best-effort cleanup
  }

  if (storagePaths.length === 0) return;
  try {
    await supabase.storage.from(MEDIA_BUCKET).remove(storagePaths);
  } catch {
    // ignore cleanup errors
  }
};

const coerceMessageType = (value: string): Message['type'] => {
  const allowed: Message['type'][] = ['text', 'photo', 'video', 'audio', 'poll', 'i18n', 'sticker'];
  return allowed.includes(value as Message['type']) ? (value as Message['type']) : 'text';
};

const mapPostRowToMessage = (
  row: PostRow,
  adminUserId?: string | null,
  pollDataByPostId?: PollDataByPostId,
): Message => {
  const meta = (row.metadata as Record<string, unknown> | null) || {};
  const typedMedia = ((row.post_media as PostMediaWithUrl[] | null | undefined) || []).filter(Boolean);
  const mediaImages = typedMedia.filter((m) => m.media_type === 'image').map((m) => m.url || m.storage_path);
  const images =
    mediaImages.length > 0
      ? mediaImages
      : (meta.image_urls as string[] | undefined) ||
        (meta.images as string[] | undefined) ||
        [];
  const imagePreviews =
    (meta.image_preview_urls as string[] | undefined) ||
    (meta.image_previews as string[] | undefined) ||
    (meta.preview_image_urls as string[] | undefined) ||
    [];
  const messageType = coerceMessageType(row.type);
  const i18nPack = meta.i18n_pack as I18nPack | undefined;
  const pollData = pollDataByPostId?.[row.id];
  const pollQuestion = pollData?.question || (meta.poll_question as string | undefined);
  const pollOptions = pollData ? pollData.options.map((o) => o.text) : (meta.poll_options as string[] | undefined);
  const pollOptionStats =
    pollData?.options ||
    (messageType === 'poll' && pollOptions?.length
      ? pollOptions.slice(0, 4).map((text, idx) => ({ id: `${row.id}-opt-${idx}`, text, votes: 0 }))
      : undefined);
  const pollTotalVotes =
    pollData?.totalVotes ??
    (pollOptionStats && pollOptionStats.length > 0
      ? pollOptionStats.reduce((sum, opt) => sum + (opt.votes || 0), 0)
      : undefined);
  const caption = meta.caption as string | undefined;
  const subtitle = meta.subtitle as string | undefined;
  const videoMedia = typedMedia.find((m) => m.media_type === 'video');
  const audioMedia = typedMedia.find((m) => m.media_type === 'audio');
  const videoUrl =
    videoMedia?.url ||
    videoMedia?.storage_path ||
    (meta.video_url as string | undefined);
  const audioUrl =
    audioMedia?.url ||
    audioMedia?.storage_path ||
    (meta.audio_url as string | undefined);
  const audioStoragePath =
    audioMedia?.storage_path || (audioUrl && !isHttpUrl(audioUrl) ? audioUrl : undefined);
  const bodyText = row.body_text || row.title || (meta.text as string | undefined) || '';

  const message: Message = {
    id: row.id,
    type: messageType,
    time: (meta.time_label as string | undefined) || formatShortTime(row.created_at || undefined),
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at ?? undefined,
    authorId: row.author_id || null,
    text: bodyText,
    caption,
    subtitle,
    pollQuestion,
    pollOptions,
    pollId: pollData?.pollId || (meta.poll_id as string | undefined),
    pollOptionStats,
    pollTotalVotes,
    pollUserVoteOptionId: pollData ? pollData.userVoteOptionId : null,
    i18nPack,
  };

  if (messageType === 'photo') {
    const feedImages = imagePreviews && imagePreviews.length > 0 ? imagePreviews : images;
    message.imageUrl = feedImages?.[0];
    message.images = feedImages;
    message.fullImages = images;
  }
  if (messageType === 'video') {
    message.videoUrl = videoUrl;
    const posterUrl = (meta.video_poster_url as string | undefined) || (meta.video_poster as string | undefined);
    const posterPath = meta.video_poster_path as string | undefined;
    if (posterUrl) {
      message.videoPosterUrl = posterUrl;
    } else if (posterPath) {
      message.videoPosterPath = posterPath;
    }
  }
  if (messageType === 'audio') {
    message.audioUrl = audioUrl;
    message.audioStoragePath = audioStoragePath || undefined;
    // Debug: log audio mapping
    console.log('[mapPostRowToMessage] Audio post mapped:', {
      postId: row.id,
      audioMediaFound: !!audioMedia,
      audioMediaUrl: audioMedia?.url,
      audioMediaStoragePath: audioMedia?.storage_path,
      metaAudioUrl: meta.audio_url,
      finalAudioUrl: audioUrl,
      finalStoragePath: audioStoragePath,
    });
  }

  // Posts authored by the configured admin get an admin flag for downstream UI if needed.
  if (adminUserId && row.author_id && row.author_id === adminUserId) {
    message.isTest = false;
  }

  return message;
};

const mapCommentRow = (row: CommentRow, adminUserId?: string | null): Comment => {
  const isAdminAuthor = Boolean(adminUserId && row.user_id && row.user_id === adminUserId);
  return {
    id: row.id,
    author: isAdminAuthor ? 'Kareevsky' : 'Member',
    text: row.body_text || '',
    userId: row.user_id || null,
    postId: row.post_id || null,
    updatedAt: row.updated_at ?? undefined,
  };
};

const mapDirectMessageRow = (row: DirectMessageRow, adminUserId?: string | null): PersonalMessage => {
  const isAdminAuthor = Boolean(adminUserId && row.from_user_id && row.from_user_id === adminUserId);
  return {
    id: row.id,
    author: isAdminAuthor ? 'artist' : 'listener',
    time: formatShortTime(row.created_at || undefined),
    createdAt: row.created_at || undefined,
    date: formatShortDate(row.created_at || undefined),
    text: row.body_text || '',
    fromUserId: row.from_user_id || null,
    toAdminId: row.to_admin_id || null,
    updatedAt: row.updated_at ?? undefined,
  };
};

const isHttpUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

const normalizeStoragePath = (value?: string | null) => {
  if (!value) return null;
  const withoutProtocol = value.replace(
    /^https?:\/\/[^/]+\/storage\/v1\/object\/(?:sign|public)\/[^/]+\//i,
    '',
  );
  const withoutBucket = withoutProtocol.startsWith(`${MEDIA_BUCKET}/`)
    ? withoutProtocol.slice(MEDIA_BUCKET.length + 1)
    : withoutProtocol;
  return withoutBucket.replace(/^\/+/, '');
};

const buildPublicStorageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path.replace(/^\/+/, '')}`;
};

const guessAudioMimeType = (value?: string | null) => {
  if (!value) return undefined;
  const clean = (value.split('?')[0] || '').toLowerCase();
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
  if (clean.endsWith('.mp3')) return 'audio/mp3';
  if (clean.endsWith('.m4a') || clean.endsWith('.mp4') || clean.endsWith('.aac')) return 'audio/mp4';
  if (clean.endsWith('.wav')) return 'audio/wav';
  if (clean.endsWith('.ogg') || clean.endsWith('.oga')) return 'audio/ogg';
  if (clean.endsWith('.webm')) return 'audio/webm';
  return undefined;
};

type AudioPostPlayerProps = {
  audioUrl?: string | null;
  storagePath?: string | null;
  isReader: boolean;
};

function AudioPostPlayer({ audioUrl, storagePath, isReader }: AudioPostPlayerProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const basePath = storagePath || audioUrl || '';

    setStatus('loading');
    setErrorMessage(null);
    setResolvedSrc(null);

    const tryResolve = async () => {
      // If already an http URL, use directly
      if (audioUrl && isHttpUrl(audioUrl)) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AudioPostPlayer] Using direct URL:', audioUrl);
        }
        setResolvedSrc(audioUrl);
        setStatus('ready');
        return;
      }

      const normalizedPath = normalizeStoragePath(basePath);
      if (!normalizedPath) {
        setStatus('error');
        setErrorMessage('Invalid audio path');
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(normalizedPath, 3600);
          if (data?.signedUrl) {
            if (!cancelled) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[AudioPostPlayer] Signed URL resolved:', data.signedUrl.slice(0, 80) + '...');
              }
              setResolvedSrc(data.signedUrl);
              setStatus('ready');
            }
            return;
          }
          if (error && process.env.NODE_ENV !== 'production') {
            console.warn('[AudioPostPlayer] Signed URL error:', error.message);
          }
          const { data: pubData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(normalizedPath);
          if (pubData?.publicUrl) {
            if (!cancelled) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[AudioPostPlayer] Public URL resolved:', pubData.publicUrl);
              }
              setResolvedSrc(pubData.publicUrl);
              setStatus('ready');
            }
            return;
          }
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[AudioPostPlayer] Supabase error:', err);
          }
        }
      }

      const manual = buildPublicStorageUrl(normalizedPath);
      if (manual) {
        if (!cancelled) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[AudioPostPlayer] Manual URL fallback:', manual);
          }
          setResolvedSrc(manual);
          setStatus('ready');
        }
        return;
      }

      if (!cancelled) {
        setStatus('error');
        setErrorMessage('Could not load audio');
      }
    };

    void tryResolve();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, storagePath]);

  const mimeType = guessAudioMimeType(resolvedSrc || storagePath || audioUrl) || 'audio/mpeg';
  const playbackSrc =
    resolvedSrc ||
    (audioUrl && isHttpUrl(audioUrl) ? audioUrl : null) ||
    buildPublicStorageUrl(normalizeStoragePath(storagePath || audioUrl)) ||
    '';

  // Dev log: confirm audio element mounting
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AudioPostPlayer] Mounted with src:', playbackSrc || '(empty)', '| status:', status);
    }
  }, [playbackSrc, status]);

  // Always render audio element with controls - never hide it
  return (
    <div
      style={{ width: '100%' }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <audio
        key={playbackSrc || 'audio-fallback'}
        controls
        preload="none"
        playsInline
        // @ts-expect-error disable PiP is supported by some browsers but not in typings
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        style={{ width: '100%', display: 'block', minHeight: '40px' }}
        src={playbackSrc || undefined}
        onLoadedMetadata={() => setStatus('ready')}
        onPlay={() => setStatus('ready')}
        onError={() => {
          setStatus('error');
          setErrorMessage('Audio failed to play');
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {playbackSrc && <source src={playbackSrc} type={mimeType} />}
        Your browser does not support audio.
      </audio>
      {status === 'loading' && (
        <div style={{ padding: '4px 0', color: 'rgba(0,0,0,0.5)', fontSize: '12px' }}>Loading…</div>
      )}
      {status === 'error' && (
        <div style={{ padding: '4px 0', color: '#c44', fontSize: '12px' }}>{errorMessage || 'Audio error'}</div>
      )}
    </div>
  );
}

const Icons = {
  menu: (
    <svg className="icon icon--lg" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  ),
  message: (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  bookmark: (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  bookmarkFilled: (
    <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  documents: (
    <svg className="icon" viewBox="0 0 24 24">
      <rect x="5" y="3" width="14" height="18" rx="2" ry="2" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  ),
  sparkle: (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  ),
  share: (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="M16 8l-4-4-4 4" />
      <path d="M12 4v12" />
    </svg>
  ),
  back: (
    <svg className="icon icon--lg" viewBox="0 0 24 24">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  close: (
    <svg className="icon icon--lg" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  gallery: (
    <svg className="icon icon--lg" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  audio: (
    <svg className="icon icon--lg" viewBox="0 0 24 24">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  ),
  write: (
    <svg className="icon icon--lg" viewBox="0 0 24 24">
      <path d="M12 19l7-7 3 3-7 7H12v-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
    </svg>
  ),
  coffee: (
    <svg className="icon icon--lg" viewBox="0 0 24 24">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  download: (
    <svg className="icon icon--lg" viewBox="0 0 24 24">
      <path d="M12 3v12" />
      <path d="M6 13l6 6 6-6" />
      <path d="M5 21h14" />
    </svg>
  ),
  refresh: (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c3.2 0 6.05-1.63 7.68-4.11" />
      <path d="M21 6v6h-6" />
    </svg>
  ),
  play: (
    <svg className="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  pause: (
    <svg className="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  plus: (
    <svg className="icon" viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  fullscreen: (
    <svg className="icon" viewBox="0 0 24 24">
      <polyline points="9 3 3 3 3 9" />
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <polyline points="15 21 21 21 21 15" />
      <line x1="3" y1="3" x2="9" y2="9" />
      <line x1="21" y1="3" x2="15" y2="9" />
      <line x1="3" y1="21" x2="9" y2="15" />
      <line x1="21" y1="21" x2="15" y2="15" />
    </svg>
  ),
  compress: (
    <svg className="icon" viewBox="0 0 24 24">
      <polyline points="9 7 9 3 3 3" />
      <line x1="3" y1="3" x2="7" y2="7" />
      <polyline points="15 7 15 3 21 3" />
      <line x1="21" y1="3" x2="17" y2="7" />
      <polyline points="9 17 9 21 3 21" />
      <line x1="3" y1="21" x2="7" y2="17" />
      <polyline points="15 17 15 21 21 21" />
      <line x1="21" y1="21" x2="17" y2="17" />
    </svg>
  ),
};

const photoCaptions: Record<string, string> = {
  m2: 'Evening light... there is something special about this hour',
  m4: 'Words on paper feel different than on screen',
  m7: 'Found this in an old notebook. Still true.',
};

const sortFilesByLastModifiedAsc = (files: File[]) =>
  files
    .map((f, index) => ({ f, index }))
    .sort((a, b) => {
      if (a.f.lastModified !== b.f.lastModified) {
        return a.f.lastModified - b.f.lastModified;
      }
      if (a.index !== b.index) {
        return a.index - b.index;
      }
      return a.f.name.localeCompare(b.f.name);
    })
    .map(({ f }) => f);

// Branding constants (easy to rename later)
const BRANDING = {
  name: 'Kareevsky',
  prefix: 'House of',
  tagline: 'Private Atelier • Complete Works • Vlog',
};

export default function HomePage() {
  const access = useAccessRedirect('feed');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<View>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState>(null);

  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionsMap>({});
  const [bookmarks, setBookmarks] = useState<BookmarksMap>({});
  const [pollVoteLoadingById, setPollVoteLoadingById] = useState<Record<string, boolean>>({});
  const [adminInbox, setAdminInbox] = useState<AdminInboxState>({ hasUnread: false, count: 0 });

  const [writeText, setWriteText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [personalMessages, setPersonalMessages] = useState<PersonalMessage[]>([]);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, Comment[]>>({});
  const [commentReply, setCommentReply] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSavingId, setCommentSavingId] = useState<string | null>(null);
  const [commentDeletingId, setCommentDeletingId] = useState<string | null>(null);
  const [commentActionsOpenId, setCommentActionsOpenId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postDrafts, setPostDrafts] = useState<Record<string, string>>({});
  const [postSavingId, setPostSavingId] = useState<string | null>(null);
  const [postDeletingId, setPostDeletingId] = useState<string | null>(null);
  const [postActionsOpenId, setPostActionsOpenId] = useState<string | null>(null);
  const [editingDmId, setEditingDmId] = useState<string | null>(null);
  const [dmDrafts, setDmDrafts] = useState<Record<string, string>>({});
  const [dmSavingId, setDmSavingId] = useState<string | null>(null);
  const [dmDeletingId, setDmDeletingId] = useState<string | null>(null);
  const [dmActionsOpenId, setDmActionsOpenId] = useState<string | null>(null);
  const [createTab, setCreateTab] = useState<'text' | 'media' | 'audio' | 'poll' | 'languages'>('text');
  const [createTextTitle, setCreateTextTitle] = useState('');
  const [createTextBody, setCreateTextBody] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUpload, setAudioUpload] = useState<MediaUploadResult | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  // Multi-language post state
  const [i18nMode, setI18nMode] = useState<I18nMode>('text');
  const [i18nTexts, setI18nTexts] = useState<Record<I18nLang, string>>({ en: '', es: '', fr: '', it: '' });
  const [i18nFiles, setI18nFiles] = useState<Record<I18nLang, File[]>>({
    en: [],
    es: [],
    fr: [],
    it: [],
  });
  const [i18nPreviews, setI18nPreviews] = useState<Record<I18nLang, string[]>>({
    en: [],
    es: [],
    fr: [],
    it: [],
  });
  const audioUploadRequestId = useRef(0);
  const i18nFileInputRefs = useRef<Record<I18nLang, HTMLInputElement | null>>({ en: null, es: null, fr: null, it: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const adminUserIdRef = useRef<string | null>(ADMIN_USER_ID);
  const [photoAboutOpen, setPhotoAboutOpen] = useState(false);
  const [photoOfDayLoading, setPhotoOfDayLoading] = useState(false);
  const [photoOfDayHasMoreOlder, setPhotoOfDayHasMoreOlder] = useState(true);
  const photoOfDayRequestIdRef = useRef(0);
  const photoOfDayLoadingMoreRef = useRef(false);
  const galleryPhotosRef = useRef<PhotoOfDayItem[]>([]);
  const currentPhotoIndexRef = useRef(0);
  const photoOfDayHasMoreOlderRef = useRef(true);

  const [galleryPhotos, setGalleryPhotos] = useState<PhotoOfDayItem[]>([]);
  const [addPhotoDayOpen, setAddPhotoDayOpen] = useState(false);
  const [photoOfDayPublishing, setPhotoOfDayPublishing] = useState(false);
  const [newPhotoDayFiles, setNewPhotoDayFiles] = useState<File[]>([]);
  const [newPhotoDayPreviews, setNewPhotoDayPreviews] = useState<string[]>([]);
  const [newPhotoDayDescs, setNewPhotoDayDescs] = useState<string[]>([]);
  const [newPhotoDayDates, setNewPhotoDayDates] = useState<string[]>([]);
  const [newPhotoDayTimes, setNewPhotoDayTimes] = useState<string[]>([]);
  const [feedMessages, setFeedMessages] = useState<Message[]>([]);
  const FEED_PAGE_SIZE = 7;
  const FEED_AUTO_PAGE_LIMIT = 3;
  const [feedHasMoreOlder, setFeedHasMoreOlder] = useState(true);
  const [feedShowLoadMore, setFeedShowLoadMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const feedCacheRef = useRef<FeedCacheV1 | null>(null);
  const feedMessagesRef = useRef<Message[]>([]);
  const commentsByPostIdRef = useRef<Record<string, Comment[]>>({});
  const feedPagesLoadedRef = useRef(0);
  const feedAutoPagesLoadedRef = useRef(0);
  const feedHasMoreOlderRef = useRef(true);
  const feedLoadedCursorsRef = useRef<Set<string>>(new Set());
  const feedLoadingMoreRef = useRef(false);
  const feedOldestCursorRef = useRef<string | null>(null);
  const feedPaginationRafRef = useRef<number | null>(null);
  const feedLastAutoLoadAtRef = useRef(0);
  const loadMoreFeedPostsRef = useRef<((mode: 'auto' | 'manual') => Promise<void>) | null>(null);
  const [postsSource, setPostsSource] = useState<'supabase' | 'mock' | 'uninitialized'>('uninitialized');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [actionLock, setActionLock] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [galleryTab, setGalleryTab] = useState<GalleryTab>('photoOfDay');
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosBrowser, setIsIosBrowser] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [pushDebug, setPushDebug] = useState<Record<string, unknown> | null>(null);
  const [pushLastError, setPushLastError] = useState<string | null>(null);

  const pushToast = useCallback((text: string, timeoutMs = 2500) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), timeoutMs);
  }, []);
  const getOneSignalSubscriptionState = useCallback(
    async (OneSignalInstance?: any) => {
      const OneSignal = OneSignalInstance;
      if (!OneSignal) return false;

      try {
        const userSub = OneSignal?.User?.PushSubscription;
        if (userSub) {
          const { getOptedIn, optedIn } = userSub;
          if (typeof getOptedIn === 'function') {
            const result = await getOptedIn();
            if (typeof result === 'boolean') return result;
          }
          if (typeof optedIn === 'boolean') return optedIn;
          if (typeof optedIn === 'function') {
            const result = await optedIn();
            if (typeof result === 'boolean') return result;
          }
          if (optedIn && typeof optedIn.then === 'function') {
            const result = await optedIn;
            if (typeof result === 'boolean') return result;
          }
        }

        if (OneSignal?.Notifications?.isSubscribed) {
          return Boolean(await OneSignal.Notifications.isSubscribed());
        }
        if (OneSignal?.Notifications?.isPushEnabled) {
          return Boolean(await OneSignal.Notifications.isPushEnabled());
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[push] Subscription read failed', err);
        }
      }

      return false;
    },
    [],
  );
  const syncPushStatus = useCallback(
    async (OneSignalInstance?: any) => {
      const perm = typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as NotificationPermission);
      setPushPermission(perm === 'default' || perm === 'granted' || perm === 'denied' ? perm : 'unsupported');
      const OneSignal = OneSignalInstance;

      if (perm === 'denied' || perm === 'unsupported') {
        setPushEnabled(false);
      }

      if (!OneSignal) return;
      try {
        const supported = OneSignal?.Notifications?.isPushSupported ? await OneSignal.Notifications.isPushSupported() : true;
        if (!supported) {
          setPushPermission('unsupported');
          setPushEnabled(false);
          return;
        }
        const subscribed = await getOneSignalSubscriptionState(OneSignal);
        setPushEnabled(Boolean(subscribed));
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[push] Status sync failed', err);
        }
      }
    },
    [getOneSignalSubscriptionState],
  );
  const refreshPushStatus = useCallback(() => {
    if (typeof window === 'undefined') {
      setPushPermission('unsupported');
      setPushEnabled(false);
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await syncPushStatus(OneSignal);
    });
    syncPushStatus();
  }, [syncPushStatus]);

  const isPushDebugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('debugPush') === '1';
    } catch {
      return false;
    }
  }, []);

  const collectPushDebug = useCallback(
    async (OneSignalInstance?: any) => {
      if (!isPushDebugEnabled || typeof window === 'undefined') return;
      const OneSignal = OneSignalInstance;
      try {
        const regs = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
        const sw = regs.map((r) => {
          const scriptUrl = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || '';
          return { scope: r.scope, scriptURL: scriptUrl };
        });
        let isSupported: boolean | null = null;
        try {
          if (OneSignal?.Notifications?.isPushSupported) {
            isSupported = Boolean(await OneSignal.Notifications.isPushSupported());
          }
        } catch {
          // ignore
        }

        const subscribed = OneSignal ? await getOneSignalSubscriptionState(OneSignal) : false;
        setPushDebug({
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          standalone: isStandaloneDisplay(),
          secureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
          origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
          pushState: { pushPermission, pushEnabled },
          oneSignalLoaded: Boolean(OneSignal),
          oneSignalGlobalPresent: typeof (window as any).OneSignal !== 'undefined',
          oneSignalSupported: isSupported,
          oneSignalSubscribed: subscribed,
          serviceWorkers: sw,
        });
      } catch (err) {
        setPushDebug({ error: err instanceof Error ? err.message : String(err) });
      }
    },
    [getOneSignalSubscriptionState, isPushDebugEnabled, pushEnabled, pushPermission],
  );

  const withOneSignal = useCallback(
    async (fn: (OneSignal: any) => Promise<void>) => {
      if (typeof window === 'undefined') return;
      let called = false;
      const timer = window.setTimeout(() => {
        if (called) return;
        setPushLastError('OneSignal SDK did not respond (blocked or not loaded).');
        pushToast('OneSignal SDK not loaded/blocked. Open with ?debugPush=1 for details.', 4000);
        void collectPushDebug(undefined);
      }, 1800);

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        called = true;
        window.clearTimeout(timer);
        await fn(OneSignal);
      });
    },
    [collectPushDebug, pushToast],
  );

  const handleToggleNotifications = useCallback(() => {
    if (typeof window === 'undefined') return;
    void collectPushDebug(undefined);
    void withOneSignal(async (OneSignal) => {
      let permission =
        typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as NotificationPermission);
      const isSubscribedBefore = await getOneSignalSubscriptionState(OneSignal);
      console.log('[push-debug] permission', permission, 'isSubscribed before', isSubscribedBefore);
      setPushLastError(null);

      setPushPermission(permission === 'default' || permission === 'granted' || permission === 'denied' ? permission : 'unsupported');

      if (permission === 'default') {
        pushToast('Requesting notification permission…', 2000);
        try {
          if (OneSignal?.Notifications?.requestPermission) {
            await OneSignal.Notifications.requestPermission();
          } else if (OneSignal?.showNativePrompt) {
            await OneSignal.showNativePrompt();
          } else if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
            await Notification.requestPermission();
          }
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[push] Permission request failed', err);
          }
        }

        permission =
          typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as NotificationPermission);
        setPushPermission(
          permission === 'default' || permission === 'granted' || permission === 'denied' ? permission : 'unsupported',
        );
      }

      if (permission === 'denied' || permission === 'unsupported') {
        setPushEnabled(false);
        pushToast('Notifications are blocked by browser settings.', 3000);
        return;
      }

      // If the user dismissed the prompt, permission can remain "default" — just sync UI state.
      if (permission === 'default') {
        await syncPushStatus(OneSignal);
        await collectPushDebug(OneSignal);
        return;
      }

      try {
        pushToast(isSubscribedBefore ? 'Turning notifications off…' : 'Turning notifications on…', 2000);
        if (isSubscribedBefore) {
          if (OneSignal?.User?.PushSubscription?.optOut) {
            await OneSignal.User.PushSubscription.optOut();
          } else if (OneSignal?.Notifications?.unsubscribe) {
            await OneSignal.Notifications.unsubscribe();
          } else if (OneSignal?.Notifications?.setSubscription) {
            await OneSignal.Notifications.setSubscription(false);
          }
        } else {
          if (OneSignal?.User?.PushSubscription?.optIn) {
            await OneSignal.User.PushSubscription.optIn();
          } else if (OneSignal?.Notifications?.subscribe) {
            await OneSignal.Notifications.subscribe();
          } else if (OneSignal?.Notifications?.setSubscription) {
            await OneSignal.Notifications.setSubscription(true);
          }
        }
      } catch (err) {
        setPushLastError(err instanceof Error ? err.message : String(err));
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[push] Toggle failed', err);
        }
      }

      const isSubscribedAfter = await getOneSignalSubscriptionState(OneSignal);
      console.log('[push-debug] isSubscribed after', isSubscribedAfter);
      if (!isSubscribedAfter) {
        pushToast('Push subscription did not activate. Open with ?debugPush=1 to see why.', 4000);
      } else {
        pushToast('Notifications enabled.', 2000);
      }

      await syncPushStatus(OneSignal);
      await collectPushDebug(OneSignal);
    });
  }, [collectPushDebug, getOneSignalSubscriptionState, pushToast, syncPushStatus, withOneSignal]);
  const pushState = useMemo<'on' | 'off' | 'denied'>(() => {
    if (pushPermission === 'denied' || pushPermission === 'unsupported') return 'denied';
    return pushEnabled ? 'on' : 'off';
  }, [pushEnabled, pushPermission]);
  const handleNotificationsClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (pushState === 'denied') return;
      // IMPORTANT: requesting Notification permission must happen in the direct click handler
      // (otherwise browsers may block the prompt). We still use OneSignal for the actual subscribe/opt-in.
      if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
        const perm = Notification.permission as NotificationPermission;
        if (perm === 'default') {
          const req = Notification.requestPermission();
          void Promise.resolve(req as unknown).finally(() => {
            handleToggleNotifications();
          });
          return;
        }
      }
      handleToggleNotifications();
    },
    [handleToggleNotifications, pushState],
  );
  const pendingScrollToBottom = useRef(false);
  const forceScrollToBottom = useRef(false);
  const bodyOverflowRef = useRef<string | null>(null);
  const didInitialScroll = useRef(false);
  const userHasScrolledUpRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const postsRequestIdRef = useRef(0);
  const loadingPostsRef = useRef(false);
  const isMountedRef = useRef(true);
  const actionLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const feedScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollDistanceRafRef = useRef<number | null>(null);
  const photoViewerContainerRef = useRef<HTMLDivElement | null>(null);
  const photoSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const [isPortrait, setIsPortrait] = useState(true);
  const [currentImageAspect, setCurrentImageAspect] = useState<number | null>(null);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [rotateHintDismissed, setRotateHintDismissed] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerViewport, setViewerViewport] = useState({ width: 0, height: 0 });
  const isPhotoOpen = Boolean(photoViewer);
  const BOTTOM_EPSILON_PX = 4;
  const pushBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getScreenOrientation = () =>
    typeof window === 'undefined'
      ? null
      : (window.screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
          unlock?: () => void;
        });

  const getDocumentScrollElement = useCallback(() => {
    if (typeof document === 'undefined') return null;
    return (document.scrollingElement as HTMLElement | null) || document.documentElement;
  }, []);

  const resolveScrollContainer = useCallback(() => {
    const docTarget = getDocumentScrollElement();
    const feedEl = feedScrollContainerRef.current;

    if (feedEl) {
      const canScrollFeed = feedEl.scrollHeight - feedEl.clientHeight > 16;
      if (canScrollFeed) {
        // Only treat the feed element as the scroll container when it is actually scrollable.
        // Otherwise the document scrolls and attaching listeners to feedEl breaks pagination.
        try {
          const style = window.getComputedStyle(feedEl);
          const overflowY = (style.overflowY || '').toLowerCase();
          const isScrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
          if (isScrollable) return feedEl;
        } catch {
          // If computed style fails, fall back to document scrolling.
        }
      }
    }

    return docTarget;
  }, [getDocumentScrollElement]);

  const getScrollTarget = useCallback(() => scrollElementRef.current || resolveScrollContainer(), [resolveScrollContainer]);

  const scheduleScrollStateCheck = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (scrollDistanceRafRef.current !== null) {
      cancelAnimationFrame(scrollDistanceRafRef.current);
    }

    scrollDistanceRafRef.current = window.requestAnimationFrame(() => {
      scrollDistanceRafRef.current = null;

      const target = getScrollTarget();
      if (!target) return;

      const scrollTop = target.scrollTop;
      const maxScrollTop = Math.max(target.scrollHeight - target.clientHeight, 0);
      const distanceToBottom = maxScrollTop - scrollTop;
      const atBottom = distanceToBottom <= BOTTOM_EPSILON_PX;

      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;

      if (atBottom) {
        if (userHasScrolledUpRef.current) {
          userHasScrolledUpRef.current = false;
          setUserHasScrolledUp(false);
        }
      } else if (scrollTop < lastScrollTopRef.current - 0.5) {
        if (!userHasScrolledUpRef.current) {
          userHasScrolledUpRef.current = true;
          setUserHasScrolledUp(true);
        }
      }

      lastScrollTopRef.current = scrollTop;
    });
  }, [BOTTOM_EPSILON_PX, getScrollTarget]);

  const scheduleFeedPaginationCheck = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (feedPaginationRafRef.current !== null) return;

    feedPaginationRafRef.current = window.requestAnimationFrame(() => {
      feedPaginationRafRef.current = null;
      if (activeView !== 'home') return;
      if (postsSource !== 'supabase') return;
      if (!feedHasMoreOlderRef.current) return;

      const target = getScrollTarget();
      if (!target) return;
      const scrollTop = target.scrollTop;
      const nearTop = scrollTop <= 120;
      if (!nearTop) return;

      // Only auto-load up to 3 pages. After that, show the button.
      if (feedPagesLoadedRef.current >= FEED_AUTO_PAGE_LIMIT) {
        setFeedShowLoadMore(true);
        return;
      }

      const now = Date.now();
      if (now - feedLastAutoLoadAtRef.current < 1200) return;
      feedLastAutoLoadAtRef.current = now;

      void loadMoreFeedPostsRef.current?.('auto');
    });
  }, [FEED_AUTO_PAGE_LIMIT, activeView, getScrollTarget, postsSource]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const target = getScrollTarget();
      if (!target) return;

      target.scrollTo({ top: target.scrollHeight, behavior });
      isAtBottomRef.current = true;
      setIsAtBottom(true);
      if (userHasScrolledUpRef.current) {
        userHasScrolledUpRef.current = false;
        setUserHasScrolledUp(false);
      }
      lastScrollTopRef.current = target.scrollTop;
    },
    [getScrollTarget],
  );

  const scrollToBottomImmediate = useCallback(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  const session = access.session;
  const user = session?.user;

  useEffect(() => {
    const cached = readPhotoOfDayCache();
    if (!cached) return;
    setGalleryPhotos([cached]);
    setCurrentPhotoIndex(0);
    setPhotoOfDayHasMoreOlder(true);
  }, []);

  useEffect(() => {
    const cached = readFeedCache();
    if (!cached || !cached.messages || cached.messages.length === 0) return;
    feedCacheRef.current = cached;
    setFeedMessages(cached.messages);
    setCommentsByPostId(cached.commentsByPostId || {});
    setPostsSource('supabase');
    const pagesLoaded = Math.min(Math.max(cached.pagesLoaded || 1, 1), FEED_AUTO_PAGE_LIMIT);
    feedPagesLoadedRef.current = pagesLoaded;
    feedAutoPagesLoadedRef.current = pagesLoaded;
    feedLoadedCursorsRef.current = new Set(['__first__']);
    const oldestCursor = cached.oldestCursor || cached.messages[0]?.createdAt || null;
    feedOldestCursorRef.current = oldestCursor;
    setFeedHasMoreOlder(Boolean(cached.hasMoreOlder));
    setFeedShowLoadMore(Boolean(cached.hasMoreOlder && pagesLoaded >= FEED_AUTO_PAGE_LIMIT));
  }, [FEED_AUTO_PAGE_LIMIT]);

  useEffect(() => {
    galleryPhotosRef.current = galleryPhotos;
  }, [galleryPhotos]);

  useEffect(() => {
    currentPhotoIndexRef.current = currentPhotoIndex;
  }, [currentPhotoIndex]);

  useEffect(() => {
    photoOfDayHasMoreOlderRef.current = photoOfDayHasMoreOlder;
  }, [photoOfDayHasMoreOlder]);

  useEffect(() => {
    feedHasMoreOlderRef.current = feedHasMoreOlder;
  }, [feedHasMoreOlder]);

  useEffect(() => {
    feedMessagesRef.current = feedMessages;
  }, [feedMessages]);

  useEffect(() => {
    commentsByPostIdRef.current = commentsByPostId;
  }, [commentsByPostId]);

  useEffect(() => {
    if (galleryPhotos.length === 0) {
      if (currentPhotoIndex !== 0) setCurrentPhotoIndex(0);
      return;
    }
    if (currentPhotoIndex > galleryPhotos.length - 1) {
      setCurrentPhotoIndex(galleryPhotos.length - 1);
    }
  }, [currentPhotoIndex, galleryPhotos.length]);

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const pullDistanceRef = useRef(0);
  const lastTapTime = useRef<number>(0);

  const currentPhoto = galleryPhotos.length ? galleryPhotos[currentPhotoIndex] : null;
  const filteredMessages = feedMessages.filter(
    (m) => m.type !== 'sticker' && (!m.isTest || isAdmin), // hide test posts for non-admins
  );
  const savedMessages = filteredMessages.filter((m) => bookmarks[m.id]);
  const commentsForActiveMessage =
    activeMessageId && commentsByPostId[activeMessageId]
      ? commentsByPostId[activeMessageId]
      : postsSource === 'mock'
        ? fakeComments
        : [];
  const unreadAdminCount = adminMessages.filter((m) => m.isUnread).length;
  const feedItems = useMemo(() => {
    const items: Array<
      | { type: 'date'; id: string; label: string }
      | { type: 'message'; message: Message }
    > = [];
    let prevDate: string | undefined;
    filteredMessages.forEach((msg, idx) => {
      const label = formatDayLabel(msg.createdAt);
      if (!prevDate || !isSameDay(msg.createdAt, prevDate)) {
        items.push({ type: 'date', id: `feed-date-${msg.id}-${idx}`, label });
        prevDate = msg.createdAt || prevDate;
      }
      items.push({ type: 'message', message: msg });
    });
    return items;
  }, [filteredMessages]);

  const showLatestButton = userHasScrolledUp && !isAtBottom;

  const showToast = useCallback((text: string, timeoutMs = 2500) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), timeoutMs);
  }, []);

  const persistFeedCacheSnapshot = useCallback(
    (override?: {
      messages?: Message[];
      commentsByPostId?: Record<string, Comment[]>;
      pagesLoaded?: number;
      hasMoreOlder?: boolean;
    }) => {
      const messagesSnapshot = override?.messages ?? feedMessagesRef.current;
      if (!messagesSnapshot || messagesSnapshot.length === 0) return;

      const maxMessages = FEED_PAGE_SIZE * FEED_AUTO_PAGE_LIMIT;
      const trimmed = messagesSnapshot.slice(Math.max(0, messagesSnapshot.length - maxMessages));
      const ids = new Set(trimmed.map((m) => m.id));

      const commentsSnapshot = override?.commentsByPostId ?? commentsByPostIdRef.current;
      const filteredComments: Record<string, Comment[]> = {};
      Object.keys(commentsSnapshot || {}).forEach((postId) => {
        if (!ids.has(postId)) return;
        filteredComments[postId] = commentsSnapshot[postId];
      });

      const pagesLoaded = Math.min(
        Math.max(override?.pagesLoaded ?? feedPagesLoadedRef.current ?? 1, 1),
        FEED_AUTO_PAGE_LIMIT,
        Math.max(1, Math.ceil(trimmed.length / FEED_PAGE_SIZE)),
      );
      const hasMoreOlder = override?.hasMoreOlder ?? feedHasMoreOlderRef.current;
      const oldestCursor = trimmed[0]?.createdAt || null;

      const cache: FeedCacheV1 = {
        v: 1,
        savedAt: new Date().toISOString(),
        messages: trimmed,
        commentsByPostId: filteredComments,
        pagesLoaded,
        hasMoreOlder: Boolean(hasMoreOlder),
        oldestCursor,
      };
      feedCacheRef.current = cache;
      writeFeedCache(cache);
    },
    [FEED_AUTO_PAGE_LIMIT, FEED_PAGE_SIZE],
  );

  const canEditPost = useCallback(
    (message: Message) =>
      isAdmin || Boolean(currentUserId && message.authorId && message.authorId === currentUserId),
    [currentUserId, isAdmin],
  );

  const canDeletePost = useCallback(
    (message: Message) =>
      isAdmin || Boolean(currentUserId && message.authorId && message.authorId === currentUserId),
    [currentUserId, isAdmin],
  );

  const canEditComment = useCallback(
    (comment: Comment) =>
      isAdmin || Boolean(comment.userId && currentUserId && comment.userId === currentUserId),
    [currentUserId, isAdmin],
  );

  const canDeleteComment = useCallback(
    (comment: Comment) => {
      const isOwner = Boolean(comment.userId && currentUserId && comment.userId === currentUserId);
      return isOwner || isAdmin;
    },
    [currentUserId, isAdmin],
  );

  const canEditDirectMessage = useCallback(
    (msg: PersonalMessage) =>
      Boolean(msg.author === 'listener' && msg.fromUserId && currentUserId && msg.fromUserId === currentUserId),
    [currentUserId],
  );

  const canDeleteDirectMessage = useCallback((msg: PersonalMessage) => canEditDirectMessage(msg), [canEditDirectMessage]);

  const startActionLock = useCallback((duration = 500) => {
    if (actionLockTimeoutRef.current) {
      clearTimeout(actionLockTimeoutRef.current);
    }
    setActionLock(true);
    actionLockTimeoutRef.current = setTimeout(() => {
      setActionLock(false);
      actionLockTimeoutRef.current = null;
    }, duration);
  }, []);

  const closePostActionsMenu = useCallback(() => setPostActionsOpenId(null), []);

  const togglePostActionsMenu = useCallback(
    (messageId: string) => {
      console.log('[menu-debug] togglePostActionsMenu called, messageId:', messageId);
      setCommentActionsOpenId(null);
      setDmActionsOpenId(null);
      setPostActionsOpenId((prev) => {
        const next = prev === messageId ? null : messageId;
        console.log('[menu-debug] postActionsOpenId changing:', prev, '->', next);
        return next;
      });
    },
    [],
  );

  const closeCommentActionsMenu = useCallback(() => setCommentActionsOpenId(null), []);

  const toggleCommentActionsMenu = useCallback((commentId: string) => {
    setPostActionsOpenId(null);
    setDmActionsOpenId(null);
    setCommentActionsOpenId((prev) => (prev === commentId ? null : commentId));
  }, []);

  const closeDmActionsMenu = useCallback(() => setDmActionsOpenId(null), []);

  const toggleDmActionsMenu = useCallback((dmId: string) => {
    setPostActionsOpenId(null);
    setCommentActionsOpenId(null);
    setDmActionsOpenId((prev) => (prev === dmId ? null : dmId));
  }, []);

  useEffect(
    () => () => {
      if (actionLockTimeoutRef.current) {
        clearTimeout(actionLockTimeoutRef.current);
      }
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    // Keep local flags aligned with the shared redirect guard to avoid per-component redirect logic.
    setIsSignedIn(Boolean(session));
    setIsAdmin(access.isAdmin);
    setCurrentUserId(user?.id ?? null);
    if (access.isAdmin && user?.id) {
      adminUserIdRef.current = user.id;
    }
  }, [access.isAdmin, session, user]);

  // DEBUG: expose admin state globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__DEBUG_IS_ADMIN = isAdmin;
      (window as any).__DEBUG_CURRENT_USER_ID = currentUserId;
      console.log('[auth-debug] isAdmin:', isAdmin, 'currentUserId:', currentUserId);
    }
  }, [isAdmin, currentUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const externalId = user?.id || null;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        if (externalId) {
          await OneSignal.login(externalId);
        } else if (OneSignal.logout) {
          await OneSignal.logout();
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[push] OneSignal login/logout failed', err);
        }
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Avoid conflicting with OneSignal's Service Worker (which needs scope "/").
    // IMPORTANT: older versions of this app registered "/sw.js" with scope "/", which blocks OneSignal.
    // We proactively unregister any legacy root-scoped "/sw.js" registration.
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (reg) => {
            const scriptUrl =
              reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
            if (!scriptUrl) return;
            let pathname = '';
            try {
              pathname = new URL(scriptUrl).pathname;
            } catch {
              // ignore parse errors
              return;
            }
            if (pathname === '/sw.js') {
              await reg.unregister();
            }
          }),
        );
      } catch {
        // ignore
      }

      navigator.serviceWorker.register('/sw.js', { scope: '/sw/' }).catch(() => {
        // Registration is best-effort; offline caching can be added later.
      });
    })();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const dismissed = window.localStorage.getItem('install-banner-dismissed') === '1';
    setInstallBannerDismissed(dismissed);

    const standalone = isStandaloneDisplay();
    setIsStandalone(standalone);

    const ios = isIosSafari();
    setIsIosBrowser(ios);

    if (!standalone && !dismissed) {
      setShowInstallBanner(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setPushPermission('unsupported');
      setPushEnabled(false);
      return;
    }

    refreshPushStatus();

    const permApi = (navigator as any)?.permissions;
    let permStatus: PermissionStatus | null = null;

    if (permApi?.query) {
      permApi
        .query({ name: 'notifications' as PermissionName })
        .then((status: PermissionStatus) => {
          permStatus = status;
          setPushPermission(status.state as NotificationPermission);
          status.onchange = () => {
            setPushPermission(status.state as NotificationPermission);
            refreshPushStatus();
          };
        })
        .catch(() => {
          // ignore
        });
    }

    return () => {
      if (permStatus) permStatus.onchange = null;
    };
  }, [refreshPushStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPushDebugEnabled) return;
    pushToast('Push debug enabled', 1500);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await collectPushDebug(OneSignal);
    });
    void collectPushDebug(undefined);
  }, [collectPushDebug, isPushDebugEnabled, pushToast]);

  useEffect(() => {
    if (pushEnabled) {
      setShowPushBanner(false);
      if (pushBannerTimeoutRef.current) {
        clearTimeout(pushBannerTimeoutRef.current);
        pushBannerTimeoutRef.current = null;
      }
      return;
    }

    if (pushPermission === 'unsupported') {
      setShowPushBanner(false);
      return;
    }

    setShowPushBanner(true);
    if (pushBannerTimeoutRef.current) {
      clearTimeout(pushBannerTimeoutRef.current);
    }
    pushBannerTimeoutRef.current = setTimeout(() => setShowPushBanner(false), 5000);

    return () => {
      if (pushBannerTimeoutRef.current) {
        clearTimeout(pushBannerTimeoutRef.current);
        pushBannerTimeoutRef.current = null;
      }
    };
  }, [pushEnabled, pushPermission]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      event.preventDefault();
      setInstallPromptEvent(promptEvent);
      if (!isStandalone && !installBannerDismissed) {
        setShowInstallBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
      setShowInstallBanner(false);
      setInstallBannerDismissed(true);
      window.localStorage.setItem('install-banner-dismissed', '1');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [installBannerDismissed, isStandalone]);

  const loadPollDataForPosts = useCallback(
    async (supabaseClient: ReturnType<typeof getSupabaseBrowserClient>, posts: PostRow[]): Promise<PollDataByPostId> => {
      if (!supabaseClient) return {};
      const pollPosts = posts.filter((row) => coerceMessageType(row.type) === 'poll');
      if (pollPosts.length === 0) return {};

      const pollPostIds = pollPosts.map((row) => row.id);
      const { data: pollRows, error: pollError } = await supabaseClient
        .from('polls')
        .select(
          `
          id,
          post_id,
          question,
          poll_options (
            id,
            option_text,
            poll_votes(count)
          )
        `,
        )
        .in('post_id', pollPostIds);

      if (pollError) throw pollError;

      const typedPollRows = (pollRows as PollRow[]) || [];
      const pollIds = typedPollRows.map((p) => p.id).filter(Boolean);
      let userVotesMap: Record<string, string | null> = {};

      if (currentUserId && pollIds.length > 0) {
        const { data: userVotes, error: userVotesError } = await supabaseClient
          .from('poll_votes')
          .select('poll_id, option_id')
          .eq('user_id', currentUserId)
          .in('poll_id', pollIds);

        if (userVotesError) throw userVotesError;

        userVotesMap = (userVotes || []).reduce<Record<string, string | null>>((acc, vote) => {
          const pollId = (vote as { poll_id?: string }).poll_id;
          const optionId = (vote as { option_id?: string }).option_id;
          if (pollId) {
            acc[pollId] = optionId || null;
          }
          return acc;
        }, {});
      }

      const pollMap: PollDataByPostId = {};
      typedPollRows.forEach((poll) => {
        if (!poll.post_id) return;
        const options = (poll.poll_options || []).map<PollOptionStats>((opt) => {
          const countValue = opt.poll_votes && opt.poll_votes[0] ? Number(opt.poll_votes[0].count || 0) : 0;
          return { id: opt.id, text: opt.option_text || '', votes: Number.isFinite(countValue) ? countValue : 0 };
        });
        const totalVotes = options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
        pollMap[poll.post_id] = {
          pollId: poll.id,
          question: poll.question || '',
          options,
          totalVotes,
          userVoteOptionId: userVotesMap[poll.id] ?? null,
        };
      });

      return pollMap;
    },
    [currentUserId],
  );

  const refreshFeed = useCallback(
    async (reason: 'initial' | 'manual' | 'pull' = 'manual') => {
      if (loadingPostsRef.current) return;

      loadingPostsRef.current = true;
      const requestId = ++postsRequestIdRef.current;
      if (isMountedRef.current) {
        setLoadingPosts(true);
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (isMountedRef.current) {
          setFeedMessages([...messages].reverse());
          setCommentsByPostId({});
          setPostsSource('mock');
          setLoadingPosts(false);
        }
        loadingPostsRef.current = false;
        console.info(`[data] Supabase not configured; using mock feed data (${messages.length}).`);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('posts')
          .select(
            `
            id,
            author_id,
            type,
            title,
            body_text,
            created_at,
            updated_at,
            is_deleted,
            visibility,
            metadata,
            post_media (
              id,
              post_id,
              storage_path,
              media_type,
              width,
              height,
              duration,
              created_at
            ),
            comments:comments (
              id,
              post_id,
              user_id,
              body_text,
              created_at,
              updated_at,
              is_deleted
            )
          `,
          )
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(FEED_PAGE_SIZE);

        if (!isMountedRef.current || requestId !== postsRequestIdRef.current) return;

        if (error) {
          console.error('[data] Failed to load posts from Supabase', error);
          setFeedMessages([]);
          setCommentsByPostId({});
          setPostsSource('supabase');
          console.info('[data] Supabase load failed; falling back to empty feed (no mock data).');
          if (reason !== 'initial') {
            showToast('Failed to refresh feed. Please try again.');
          }
        } else {
          const rows = ((data as PostRow[]) || []).filter((row) => !row.is_deleted);
          let pollDataByPostId: PollDataByPostId = {};
          try {
            pollDataByPostId = await loadPollDataForPosts(supabase, rows);
          } catch (pollErr) {
            console.warn('[data] Failed to load poll data', pollErr);
          }
          const rowsWithUrls = await resolveMediaForRows(rows);
          const mapped = rowsWithUrls.map((row) =>
            mapPostRowToMessage(row, adminUserIdRef.current, pollDataByPostId),
          );
          // Keep existing chat-like UI order (oldest -> newest).
          const ascendingMessages = [...mapped].reverse();
          const commentMap: Record<string, Comment[]> = {};
          rowsWithUrls.forEach((row) => {
            const mappedComments = (row.comments || [])
              .filter((c) => !c.is_deleted)
              .map((c) => mapCommentRow(c, adminUserIdRef.current));
            if (mappedComments.length) {
              commentMap[row.id] = mappedComments;
            }
          });
          const hasMore = mapped.length === FEED_PAGE_SIZE;

          // Fast-start cache: keep cached pages when the newest page didn't change.
          const cached = reason === 'initial' ? feedCacheRef.current : null;
          const fetchedIdsKey = ascendingMessages.map((m) => m.id).join(',');
          const cachedIdsKey = cached?.messages?.slice(-FEED_PAGE_SIZE).map((m) => m.id).join(',') || '';

          if (cached && Array.isArray(cached.messages) && cached.messages.length > 0 && cachedIdsKey === fetchedIdsKey) {
            setFeedMessages((prev) => (prev && prev.length > 0 ? prev : cached.messages));
            setCommentsByPostId((prev) => ({ ...(cached.commentsByPostId || {}), ...prev, ...commentMap }));
            setPostsSource('supabase');

            const pagesLoaded = Math.min(Math.max(cached.pagesLoaded || 1, 1), FEED_AUTO_PAGE_LIMIT);
            feedPagesLoadedRef.current = pagesLoaded;
            feedAutoPagesLoadedRef.current = pagesLoaded;
            feedLoadedCursorsRef.current = new Set(['__first__']);
            feedOldestCursorRef.current = cached.oldestCursor || cached.messages[0]?.createdAt || null;

            const effectiveHasMore = Boolean(cached.hasMoreOlder ?? hasMore);
            setFeedHasMoreOlder(effectiveHasMore);
            setFeedShowLoadMore(Boolean(effectiveHasMore && pagesLoaded >= FEED_AUTO_PAGE_LIMIT));
            persistFeedCacheSnapshot({
              messages: cached.messages,
              commentsByPostId: { ...(cached.commentsByPostId || {}), ...commentMap },
              pagesLoaded,
              hasMoreOlder: effectiveHasMore,
            });

            console.info(`[data] Loaded ${ascendingMessages.length} posts from Supabase (page 1, cache hit)`);
            if (reason !== 'initial') {
              showToast('Feed updated');
            }
            return;
          }

          if (cached && Array.isArray(cached.messages) && cached.messages.length > 0) {
            // Cache exists but newest page changed: keep up to 2 older cached pages when safe.
            const cutoff = ascendingMessages[0]?.createdAt || null;
            const maxOlder = FEED_PAGE_SIZE * Math.max(0, FEED_AUTO_PAGE_LIMIT - 1);
            const keepOlder =
              cutoff
                ? cached.messages
                    .filter((m) => Boolean(m.createdAt) && (m.createdAt as string) < cutoff)
                    .slice(-maxOlder)
                : [];

            const combinedRaw = [...keepOlder, ...ascendingMessages];
            const seen = new Set<string>();
            const combined = combinedRaw.filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });

            const mergedAll = { ...(cached.commentsByPostId || {}), ...commentMap };
            const combinedIds = new Set(combined.map((m) => m.id));
            const mergedComments: Record<string, Comment[]> = {};
            Object.keys(mergedAll).forEach((id) => {
              if (combinedIds.has(id)) mergedComments[id] = mergedAll[id];
            });

            setFeedMessages(combined);
            setCommentsByPostId(mergedComments);
            setPostsSource('supabase');

            const pagesLoaded = Math.min(
              FEED_AUTO_PAGE_LIMIT,
              Math.max(1, Math.ceil(combined.length / FEED_PAGE_SIZE)),
            );
            feedPagesLoadedRef.current = pagesLoaded;
            feedAutoPagesLoadedRef.current = pagesLoaded;
            feedLoadedCursorsRef.current = new Set(['__first__']);
            feedOldestCursorRef.current = combined[0]?.createdAt || null;

            setFeedHasMoreOlder(hasMore);
            setFeedShowLoadMore(Boolean(hasMore && pagesLoaded >= FEED_AUTO_PAGE_LIMIT));
            persistFeedCacheSnapshot({
              messages: combined,
              commentsByPostId: mergedComments,
              pagesLoaded,
              hasMoreOlder: hasMore,
            });

            console.info(`[data] Loaded ${combined.length} posts from Supabase (page 1, cache merged)`);
            if (reason !== 'initial') {
              showToast('Feed updated');
            }
            return;
          }

          setFeedMessages(ascendingMessages);
          setCommentsByPostId(commentMap);
          setPostsSource('supabase');
          feedPagesLoadedRef.current = 1;
          feedAutoPagesLoadedRef.current = 1;
          feedLoadedCursorsRef.current = new Set(['__first__']);
          feedOldestCursorRef.current = ascendingMessages[0]?.createdAt || null;
          setFeedHasMoreOlder(hasMore);
          setFeedShowLoadMore(false);
          persistFeedCacheSnapshot({ messages: ascendingMessages, commentsByPostId: commentMap, pagesLoaded: 1, hasMoreOlder: hasMore });
          console.info(`[data] Loaded ${ascendingMessages.length} posts from Supabase (page 1)`);
          if (reason !== 'initial') {
            showToast('Feed updated');
          }
        }
      } finally {
        if (requestId === postsRequestIdRef.current) {
          loadingPostsRef.current = false;
          if (isMountedRef.current) {
            setLoadingPosts(false);
          }
        }
      }
    },
    [FEED_AUTO_PAGE_LIMIT, FEED_PAGE_SIZE, loadPollDataForPosts, persistFeedCacheSnapshot, showToast],
  );

  const loadMoreFeedPosts = useCallback(
    async (mode: 'auto' | 'manual') => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || postsSource !== 'supabase') return;
      if (!feedHasMoreOlderRef.current) return;
      if (feedLoadingMoreRef.current || loadingPostsRef.current) return;

      // Auto-loading is capped to the first 3 pages (21 posts).
      if (mode === 'auto' && feedPagesLoadedRef.current >= FEED_AUTO_PAGE_LIMIT) {
        setFeedShowLoadMore(true);
        return;
      }

      const oldestCursor =
        feedOldestCursorRef.current ||
        (feedMessagesRef.current.length > 0 ? feedMessagesRef.current[0]?.createdAt || null : null);
      if (!oldestCursor) {
        setFeedHasMoreOlder(false);
        return;
      }

      // Do not refetch the same cursor in one session.
      const cursorKey = oldestCursor;
      if (feedLoadedCursorsRef.current.has(cursorKey)) {
        return;
      }
      feedLoadedCursorsRef.current.add(cursorKey);

      feedLoadingMoreRef.current = true;
      setFeedLoadingMore(true);

      const scrollTarget = getScrollTarget();
      const preserveScroll = Boolean(scrollTarget && typeof (scrollTarget as HTMLElement).scrollTop === 'number');
      const prevScrollTop = preserveScroll ? (scrollTarget as HTMLElement).scrollTop : 0;
      const prevScrollHeight = preserveScroll ? (scrollTarget as HTMLElement).scrollHeight : 0;

      try {
        const { data, error } = await supabase
          .from('posts')
          .select(
            `
              id,
              author_id,
              type,
              title,
              body_text,
              created_at,
              updated_at,
              is_deleted,
              visibility,
              metadata,
              post_media (
                id,
                post_id,
                storage_path,
                media_type,
                width,
                height,
                duration,
                created_at
              ),
              comments:comments (
                id,
                post_id,
                user_id,
                body_text,
                created_at,
                updated_at,
                is_deleted
              )
            `,
          )
          .eq('is_deleted', false)
          .lt('created_at', oldestCursor)
          .order('created_at', { ascending: false })
          .limit(FEED_PAGE_SIZE);

        if (error) throw error;

        const rows = ((data as PostRow[]) || []).filter((row) => !row.is_deleted);
        let pollDataByPostId: PollDataByPostId = {};
        try {
          pollDataByPostId = await loadPollDataForPosts(supabase, rows);
        } catch (pollErr) {
          console.warn('[data] Failed to load poll data (page)', pollErr);
        }
        const rowsWithUrls = await resolveMediaForRows(rows);
        const mapped = rowsWithUrls.map((row) => mapPostRowToMessage(row, adminUserIdRef.current, pollDataByPostId));
        const olderAscending = [...mapped].reverse();

        const prevMessages = feedMessagesRef.current || [];
        const existingIds = new Set(prevMessages.map((m) => m.id));
        const uniqueOlder = olderAscending.filter((m) => !existingIds.has(m.id));
        const nextMessages = uniqueOlder.length ? [...uniqueOlder, ...prevMessages] : prevMessages;
        feedOldestCursorRef.current = nextMessages[0]?.createdAt || feedOldestCursorRef.current;
        setFeedMessages(nextMessages);

        const prevComments = commentsByPostIdRef.current || {};
        const nextComments: Record<string, Comment[]> = { ...prevComments };
        rowsWithUrls.forEach((row) => {
          const mappedComments = (row.comments || [])
            .filter((c) => !c.is_deleted)
            .map((c) => mapCommentRow(c, adminUserIdRef.current));
          if (mappedComments.length) {
            nextComments[row.id] = mappedComments;
          }
        });
        setCommentsByPostId(nextComments);

        feedPagesLoadedRef.current += 1;
        if (mode === 'auto') {
          feedAutoPagesLoadedRef.current += 1;
        }

        const hasMore = mapped.length === FEED_PAGE_SIZE;
        setFeedHasMoreOlder(hasMore);
        if (!hasMore) {
          setFeedShowLoadMore(false);
        } else if (mode === 'auto' && feedPagesLoadedRef.current >= FEED_AUTO_PAGE_LIMIT) {
          setFeedShowLoadMore(true);
        }

        persistFeedCacheSnapshot({
          messages: nextMessages,
          commentsByPostId: nextComments,
          pagesLoaded: feedPagesLoadedRef.current,
          hasMoreOlder: hasMore,
        });

        // Preserve scroll position after prepending.
        if (preserveScroll && scrollTarget) {
          requestAnimationFrame(() => {
            const el = scrollTarget as HTMLElement;
            const newScrollHeight = el.scrollHeight;
            const delta = newScrollHeight - prevScrollHeight;
            el.scrollTop = prevScrollTop + delta;
          });
        }
      } catch (err) {
        console.error('[data] Failed to load more posts', err);
        showToast(`Failed to load more: ${friendlySupabaseError(err)}`);
      } finally {
        feedLoadingMoreRef.current = false;
        setFeedLoadingMore(false);
      }
    },
    [
      FEED_AUTO_PAGE_LIMIT,
      FEED_PAGE_SIZE,
      getScrollTarget,
      loadPollDataForPosts,
      persistFeedCacheSnapshot,
      postsSource,
      showToast,
    ],
  );

  useEffect(() => {
    loadMoreFeedPostsRef.current = loadMoreFeedPosts;
  }, [loadMoreFeedPosts]);

  const mapPhotoOfDayRowsToItems = useCallback(async (rows: PhotoOfDayRow[]): Promise<PhotoOfDayItem[]> => {
    const paths = rows.map((r) => r.image_path).filter(Boolean);
    const urlMap = await resolvePathsToSignedUrls(paths, { bucket: MEDIA_BUCKET, preferSignedUrl: true });
    return rows.map((row) => {
      const resolved = urlMap.get(row.image_path) || row.image_path;
      let url = resolved;
      // Safety: never return a relative storage path as an <img src>.
      if (url && !isProbablyUrl(url)) {
        const supabase = getSupabaseBrowserClient();
        const { data: pubData } = supabase ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(row.image_path) : { data: null };
        url = pubData?.publicUrl || url;
      }
      return {
        id: row.id,
        url,
        date: formatShortDate(row.created_at),
        time: formatShortTime(row.created_at),
        description: row.caption || '',
        createdAt: row.created_at,
        imagePath: row.image_path,
      };
    });
  }, []);

  const friendlyPhotoOfDayError = useCallback((err: unknown): string => {
    const meta = toErrorMeta(err);
    const code = (meta.code || '').trim();
    const msg = (meta.message || '').toLowerCase();

    if (code === '42501' || msg.includes('row-level security') || msg.includes('permission')) {
      return 'No access to Photo of the Day (RLS). Ensure policies allow authenticated SELECT/INSERT.';
    }
    if (
      code === '42P01' ||
      code === 'PGRST205' ||
      msg.includes('schema cache') ||
      msg.includes('relation') ||
      msg.includes('does not exist') ||
      msg.includes('photo_of_day')
    ) {
      return 'Photo of the Day table is missing/not applied in Supabase. Run the migration `supabase/migrations/20260208_photo_of_day.sql` in Supabase SQL Editor, then wait ~30s and refresh.';
    }
    if (msg.includes('bucket') && msg.includes('not found')) {
      return 'Storage bucket not found. Ensure the "media" bucket exists.';
    }
    if (msg.includes('jwt') || msg.includes('token') || msg.includes('session')) {
      return 'Session not ready. Please retry after sign-in.';
    }
    return friendlySupabaseError(err);
  }, []);

  const refreshLatestPhotoOfDay = useCallback(
    async (reason: 'initial' | 'manual' | 'open' = 'open') => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        // Dev fallback: keep mock photos available when Supabase is not configured.
        const nowIso = new Date().toISOString();
        setGalleryPhotos(photos.map((p) => ({ ...p, createdAt: nowIso })));
        setCurrentPhotoIndex(0);
        setPhotoOfDayHasMoreOlder(false);
        return;
      }

      const requestId = ++photoOfDayRequestIdRef.current;
      setPhotoOfDayLoading(true);
      try {
        const { data, error } = await supabase
          .from(PHOTO_OF_DAY_TABLE)
          .select('id, created_at, image_path, caption, created_by')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1);

        if (requestId !== photoOfDayRequestIdRef.current) return;

        if (error) {
          console.error('[photo-of-day] Failed to load latest', error);
          if (reason === 'manual') {
            showToast(`Failed to refresh photo: ${friendlyPhotoOfDayError(error)}`);
          }
          return;
        }

        const rows = ((data as PhotoOfDayRow[]) || []).filter(Boolean);
        if (rows.length === 0) {
          setGalleryPhotos([]);
          setCurrentPhotoIndex(0);
          setPhotoOfDayHasMoreOlder(false);
          return;
        }

        const items = await mapPhotoOfDayRowsToItems(rows);
        if (requestId !== photoOfDayRequestIdRef.current) return;

        const latest = items[0];
        setGalleryPhotos([latest]);
        setCurrentPhotoIndex(0);
        setPhotoOfDayHasMoreOlder(true);
        writePhotoOfDayCache(latest);
      } catch (err) {
        console.error('[photo-of-day] Unexpected error while loading latest', err);
        if (reason === 'manual') {
          showToast(`Failed to refresh photo: ${friendlyPhotoOfDayError(err)}`);
        }
      } finally {
        if (requestId === photoOfDayRequestIdRef.current) {
          setPhotoOfDayLoading(false);
        }
      }
    },
    [friendlyPhotoOfDayError, mapPhotoOfDayRowsToItems, showToast],
  );

  useEffect(() => {
    refreshFeed('initial');
  }, [refreshFeed]);

  useEffect(() => {
    if (activeView !== 'home') return;
    if (access.status !== 'allowed') return;
    if (!currentUserId) return;
    refreshLatestPhotoOfDay('open');
  }, [activeView, access.status, currentUserId, refreshLatestPhotoOfDay]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;

    let cancelled = false;

    const loadDirectMessages = async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select(
          `
            id,
            thread_id,
            from_user_id,
            to_admin_id,
            body_text,
            created_at,
            updated_at,
            is_deleted
          `,
        )
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error('[data] Failed to load direct messages', error);
        return;
      }

      const mapped =
        (data as DirectMessageRow[] | null | undefined)?.filter((row) => !row.is_deleted).map((row) => mapDirectMessageRow(row, adminUserIdRef.current)) || [];

      const adminLetters: AdminMessage[] = mapped
        .filter((msg) => msg.author === 'artist')
        .map((msg) => ({
          id: msg.id,
          author: 'Kareevsky',
          text: msg.text,
          time: msg.time,
          date: msg.date,
          createdAt: msg.createdAt,
          isUnread: false,
        }));

      setAdminMessages(adminLetters);
      setPersonalMessages(mapped.filter((msg) => msg.author === 'listener'));
    };

    loadDirectMessages();

    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;

    const upsertProfile = async () => {
      try {
        const locale = typeof navigator !== 'undefined' ? navigator.language : null;
        await supabase.from('subscriber_profiles').upsert({
          user_id: user.id,
          email: user.email,
          display_name:
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            null,
          locale,
          last_seen_at: new Date().toISOString(),
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[data] subscriber_profiles upsert failed', err);
        }
      }
    };

    upsertProfile();
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const dismissed = window.localStorage.getItem('rotate-hint-dismissed');
    if (dismissed === '1') setRotateHintDismissed(true);

    const handleResize = () => {
      setIsPortrait(window.innerHeight >= window.innerWidth);
      setViewerViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const handleFullscreenChange = () => {
      const fullscreenActive = Boolean(document.fullscreenElement);
      setIsFullscreen(fullscreenActive);
      const orientation = getScreenOrientation();
      if (!fullscreenActive && orientation?.unlock) {
        try {
          orientation.unlock();
        } catch {
          // ignore unlock failures
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const lockLandscapeOrientation = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const orientation = getScreenOrientation();
    if (!orientation?.lock) return;
    try {
      await orientation.lock('landscape');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[photo-viewer] orientation lock failed', err);
      }
    }
  }, []);

  const evaluateRotateHint = useCallback(() => {
    if (rotateHintDismissed) {
      setShowRotateHint(false);
      return;
    }
    if (!isPortrait || !currentImageAspect) {
      setShowRotateHint(false);
      return;
    }
    const isLandscapePhoto = currentImageAspect > 1.2;
    setShowRotateHint(isLandscapePhoto);
  }, [currentImageAspect, isPortrait, rotateHintDismissed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let removeScrollListener: (() => void) | null = null;

    const attachScrollListener = (target: HTMLElement) => {
      const handleScroll = () => {
        scheduleScrollStateCheck();
        scheduleFeedPaginationCheck();
      };
      const scrollTarget: HTMLElement | Window =
        typeof document !== 'undefined' && target === document.documentElement ? window : target;
      scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollTarget.removeEventListener('scroll', handleScroll);
    };

    const updateScrollContainer = () => {
      const nextTarget = resolveScrollContainer();
      if (!nextTarget) return;

      if (scrollElementRef.current !== nextTarget) {
        removeScrollListener?.();
        scrollElementRef.current = nextTarget;
        if (process.env.NODE_ENV !== 'production') {
          const label =
            nextTarget === document.documentElement ? 'document' : nextTarget.tagName || 'element';
          console.debug('[feed] scroll container', label);
        }
        removeScrollListener = attachScrollListener(nextTarget);
        lastScrollTopRef.current = nextTarget.scrollTop;
      }

      scheduleScrollStateCheck();
    };

    updateScrollContainer();

    const handleResize = () => updateScrollContainer();
    window.addEventListener('resize', handleResize);

    return () => {
      removeScrollListener?.();
      window.removeEventListener('resize', handleResize);
      if (scrollDistanceRafRef.current !== null) {
        cancelAnimationFrame(scrollDistanceRafRef.current);
        scrollDistanceRafRef.current = null;
      }
      if (feedPaginationRafRef.current !== null) {
        cancelAnimationFrame(feedPaginationRafRef.current);
        feedPaginationRafRef.current = null;
      }
    };
  }, [resolveScrollContainer, scheduleScrollStateCheck, scheduleFeedPaginationCheck, feedItems.length, activeView]);

  useEffect(() => {
    evaluateRotateHint();
  }, [evaluateRotateHint]);

  useEffect(() => {
    setCurrentImageAspect(null);
  }, [photoViewer?.index, photoViewer?.images]);

  const queueScrollToBottom = useCallback(
    (options?: { force?: boolean }) => {
      pendingScrollToBottom.current = true;
      if (options?.force) {
        forceScrollToBottom.current = true;
      }
    },
    [],
  );

  const handleDeepLink = useCallback(
    (link: string | null | undefined) => {
      if (typeof window === 'undefined' || !link) return;
      const url = new URL(link, window.location.origin);
      const open = url.searchParams.get('open');

      if (open === 'latest') {
        setActiveView('home');
        queueScrollToBottom({ force: true });
        return;
      }

      if (open === 'post') {
        const pid = url.searchParams.get('postId');
        if (pid) {
          setActiveView('home');
          setActiveMessageId(pid);
          setCommentsModalOpen(true);
        }
        return;
      }

      const path = url.pathname || '/';
      if (path.includes('/messages')) {
        setActiveView('write');
      } else if (path.includes('/admin/messages')) {
        setActiveView('write');
      }
    },
    [queueScrollToBottom],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const href = window.location.href;
    if (href.includes('open=')) {
      handleDeepLink(href);
    }
  }, [handleDeepLink]);

  useEffect(() => {
    if (activeView === 'home') {
      userHasScrolledUpRef.current = false;
      setUserHasScrolledUp(false);
      queueScrollToBottom({ force: true });
    }
  }, [activeView, queueScrollToBottom]);

  useEffect(() => {
    if (activeView !== 'home') return;
    if (!userHasScrolledUpRef.current) {
      queueScrollToBottom();
    }
  }, [activeView, feedItems.length, queueScrollToBottom]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const target = document.body;
    const restore = () => {
      if (bodyOverflowRef.current !== null) {
        target.style.overflow = bodyOverflowRef.current;
        bodyOverflowRef.current = null;
      }
    };
    if (menuOpen) {
      bodyOverflowRef.current = target.style.overflow;
      target.style.overflow = 'hidden';
    } else {
      restore();
    }
    return restore;
  }, [menuOpen]);

  useEffect(() => {
    if (activeView !== 'home') return;

    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      pendingScrollToBottom.current = false;
      forceScrollToBottom.current = false;
      requestAnimationFrame(() => {
        scrollToBottomImmediate();
        scheduleScrollStateCheck();
      });
      return;
    }

    if (!pendingScrollToBottom.current) return;
    if (userHasScrolledUpRef.current && !forceScrollToBottom.current) return;

    pendingScrollToBottom.current = false;
    const performScroll = () => {
      scrollToBottomImmediate();
      forceScrollToBottom.current = false;
      scheduleScrollStateCheck();
    };
    requestAnimationFrame(performScroll);
  }, [activeView, feedItems.length, scheduleScrollStateCheck, scrollToBottomImmediate]);

  const fetchPhotoOfDayRows = useCallback(
    async (params: { limit: number; beforeCreatedAt?: string | null }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return { rows: [] as PhotoOfDayRow[], error: null as unknown };
      }

      let query = supabase
        .from(PHOTO_OF_DAY_TABLE)
        .select('id, created_at, image_path, caption, created_by')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(params.limit);

      if (params.beforeCreatedAt) {
        query = query.lt('created_at', params.beforeCreatedAt);
      }

      const { data, error } = await query;
      return { rows: ((data as PhotoOfDayRow[]) || []).filter(Boolean), error };
    },
    [],
  );

  const loadNewestPhotoOfDayPage = useCallback(
    async (options?: { advanceAfterLoad?: boolean }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      if (photoOfDayLoadingMoreRef.current) return;
      photoOfDayLoadingMoreRef.current = true;

      const guardRequestId = photoOfDayRequestIdRef.current;
      try {
        const currentId = galleryPhotosRef.current[currentPhotoIndexRef.current]?.id || null;
        const { rows, error } = await fetchPhotoOfDayRows({ limit: 7 });
        if (guardRequestId !== photoOfDayRequestIdRef.current) return;
        if (error) {
          console.error('[photo-of-day] Failed to load first page', error);
          return;
        }

        const items = await mapPhotoOfDayRowsToItems(rows);
        if (guardRequestId !== photoOfDayRequestIdRef.current) return;

        const seen = new Set<string>();
        const deduped = items.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

        const currentIndex = currentId ? deduped.findIndex((p) => p.id === currentId) : 0;
        const baseIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = options?.advanceAfterLoad ? Math.min(baseIndex + 1, Math.max(deduped.length - 1, 0)) : baseIndex;

        setGalleryPhotos(deduped);
        setCurrentPhotoIndex(deduped.length ? nextIndex : 0);
        setPhotoOfDayHasMoreOlder(deduped.length === 7);
      } finally {
        photoOfDayLoadingMoreRef.current = false;
      }
    },
    [fetchPhotoOfDayRows, mapPhotoOfDayRowsToItems],
  );

  const loadMoreOlderPhotoOfDay = useCallback(
    async (options?: { advanceAfterLoad?: boolean }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      if (!photoOfDayHasMoreOlderRef.current) return;
      if (photoOfDayLoadingMoreRef.current) return;
      photoOfDayLoadingMoreRef.current = true;

      const guardRequestId = photoOfDayRequestIdRef.current;
      try {
        const snapshot = galleryPhotosRef.current;
        const currentIdx = currentPhotoIndexRef.current;
        const oldest = snapshot[snapshot.length - 1];
        const beforeCreatedAt = oldest?.createdAt || null;
        if (!beforeCreatedAt) {
          setPhotoOfDayHasMoreOlder(false);
          return;
        }

        const { rows, error } = await fetchPhotoOfDayRows({ limit: 7, beforeCreatedAt });
        if (guardRequestId !== photoOfDayRequestIdRef.current) return;
        if (error) {
          console.error('[photo-of-day] Failed to load older page', error);
          return;
        }

        const items = await mapPhotoOfDayRowsToItems(rows);
        if (guardRequestId !== photoOfDayRequestIdRef.current) return;

        const existingIds = new Set(snapshot.map((p) => p.id));
        const unique = items.filter((item) => !existingIds.has(item.id));
        const nextPhotos = unique.length ? [...snapshot, ...unique] : snapshot;

        setGalleryPhotos(nextPhotos);
        if (unique.length === 0 || unique.length < 7) {
          setPhotoOfDayHasMoreOlder(false);
        } else {
          setPhotoOfDayHasMoreOlder(true);
        }

        if (options?.advanceAfterLoad && unique.length > 0) {
          setCurrentPhotoIndex(Math.min(currentIdx + 1, Math.max(nextPhotos.length - 1, 0)));
        }
      } finally {
        photoOfDayLoadingMoreRef.current = false;
      }
    },
    [fetchPhotoOfDayRows, mapPhotoOfDayRowsToItems],
  );

  const goToPrevPhoto = useCallback(() => {
    if (galleryPhotosRef.current.length === 0) return;
    setCurrentPhotoIndex((idx) => (idx > 0 ? idx - 1 : 0));
  }, []);

  const goToNextPhoto = useCallback(async () => {
    const list = galleryPhotosRef.current;
    if (list.length === 0) return;

    const idx = currentPhotoIndexRef.current;
    if (idx < list.length - 1) {
      setCurrentPhotoIndex(idx + 1);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!photoOfDayHasMoreOlderRef.current) return;

    // First navigation: upgrade from a single latest photo to a 7-item page.
    if (list.length < 7) {
      await loadNewestPhotoOfDayPage({ advanceAfterLoad: true });
      return;
    }

    // Reached the oldest loaded item: load 7 more older photos and advance.
    await loadMoreOlderPhotoOfDay({ advanceAfterLoad: true });
  }, [loadMoreOlderPhotoOfDay, loadNewestPhotoOfDayPage]);

  const openPhotoViewer = (
    images: string[],
    meta?: (Omit<PhotoViewerData, 'images' | 'index'> & { startIndex?: number }),
  ) => {
    if (!images || images.length === 0) return;
    const safeIndex = Math.min(Math.max(meta?.startIndex ?? 0, 0), images.length - 1);
    setPhotoViewer({
      images,
      index: safeIndex,
      description: meta?.description,
      date: meta?.date,
      time: meta?.time,
      source: meta?.source || 'post',
    });
  };

  const openPhotoOfDay = (photo: Photo) => {
    if (actionLock) return;
    startActionLock();
    openPhotoViewer([photo.url], {
      description: photo.description,
      date: photo.date,
      time: photo.time,
      source: 'photoOfDay',
    });
  };

  const openPostGallery = (images: string[], startIndex = 0) => {
    openPhotoViewer(images, { source: 'post', startIndex });
  };

  const stepPhotoViewer = (delta: number) => {
    setPhotoViewer((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.max(0, Math.min(prev.images.length - 1, prev.index + delta));
      if (nextIndex === prev.index) return prev;
      return { ...prev, index: nextIndex };
    });
  };

  const handlePhotoViewerTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    photoSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handlePhotoViewerTouchEnd = (e: React.TouchEvent) => {
    if (!photoSwipeStart.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - photoSwipeStart.current.x;
    const dy = touch.clientY - photoSwipeStart.current.y;
    photoSwipeStart.current = null;
    const threshold = 40;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      stepPhotoViewer(dx < 0 ? 1 : -1);
    }
  };

  const closePhotoViewer = () => {
    setPhotoViewer(null);
    setShowRotateHint(false);
  };

  const toggleFullscreen = async () => {
    if (!canFullscreen || !photoViewerContainerRef.current) return;
    if (document.fullscreenElement) {
      const orientation = getScreenOrientation();
      if (orientation?.unlock) {
        try {
          orientation.unlock();
        } catch {
          // ignore unlock failures
        }
      }
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      return;
    }

    try {
      setIsFullscreen(true);
      await photoViewerContainerRef.current.requestFullscreen();
      setViewerViewport({ width: window.innerWidth, height: window.innerHeight });
      await lockLandscapeOrientation();
    } catch (err) {
      setIsFullscreen(false);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[photo-viewer] fullscreen request failed', err);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const target =
      scrollElementRef.current ||
      (document.scrollingElement as HTMLElement | null) ||
      document.documentElement;
    if (!target) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    const isAtTop = (target.scrollTop || 0) <= 0;

    if (!isAtTop || deltaY <= 0) {
      if (pullDistanceRef.current !== 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
      return;
    }

    // In the Supabase feed we use "scroll to top" to paginate older posts.
    // Disable pull-to-refresh gesture to avoid accidentally resetting the feed back to page 1.
    if (activeView === 'home' && postsSource === 'supabase') {
      if (pullDistanceRef.current !== 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
      return;
    }

    const distance = Math.min(deltaY, 120);
    pullDistanceRef.current = distance;
    setPullDistance(distance);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const atTop =
      (scrollElementRef.current?.scrollTop || 0) <= 0 ||
      (document.documentElement?.scrollTop || 0) <= 0 ||
      window.scrollY <= 0;
    const allowPullToRefresh = !(activeView === 'home' && postsSource === 'supabase');
    const shouldRefresh = allowPullToRefresh && pullDistanceRef.current > 60 && atTop;

    if (pullDistanceRef.current !== 0) {
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    if (shouldRefresh) {
      refreshFeed('pull');
    }

    // No Photo of the Day loaded: disable horizontal navigation.
    if (!currentPhoto) return;

    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        void goToNextPhoto();
      } else {
        goToPrevPhoto();
      }
    }
  };

  const handleFreeAreaClick = (e: React.MouseEvent) => {
    if (actionLock) return;
    // Click catcher for the visible photo-of-the-day background.
    // If the click started on any interactive element or message bubble, do nothing.
    const target = e.target as HTMLElement;
    if (
      target.closest('.message') ||
      target.closest('.actions') ||
      target.closest('.emoji-panel') ||
      target.closest('.photo-header') ||
      target.closest('.menu-btn') ||
      target.closest('.post-actions-menu') ||
      target.closest('.post-actions-menu__trigger') ||
      target.closest('.post-actions-menu__list') ||
      target.closest('.refresh-btn') ||
      target.closest('.notification-banner') ||
      target.closest('.bottom-sheet') ||
      target.closest('.modal') ||
      target.closest('.modal-overlay')
    ) {
      return;
    }
    if (!currentPhoto) return;
    openPhotoOfDay(currentPhoto);
  };

  const openComments = (messageId: string) => {
    setActiveMessageId(messageId);
    setCommentsModalOpen(true);
  };

  const closeComments = () => {
    setCommentsModalOpen(false);
    setActiveMessageId(null);
  };

  const toggleBookmark = (messageId: string) => {
    setBookmarks((prev) => {
      const nextValue = !prev[messageId];
      const next = { ...prev, [messageId]: nextValue };
      showToast(nextValue ? 'Saved' : 'Removed from saved', 2000);
      return next;
    });
  };

  const toggleEmojiPanel = (messageId: string) => {
    setEmojiPanelOpen(emojiPanelOpen === messageId ? null : messageId);
  };

  const selectReaction = (messageId: string, emoji: string) => {
    setReactions((prev) => ({ ...prev, [messageId]: emoji }));
    setEmojiPanelOpen(null);
  };

  const voteOnPollOption = async (pollId: string, optionId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast('Supabase is not configured.');
      return;
    }

    if (!currentUserId) {
      showToast('Please sign in to vote.');
      return;
    }

    const targetMessage = feedMessages.find((m) => m.pollId === pollId);
    if (targetMessage?.pollUserVoteOptionId) {
      showToast('You already voted.');
      return;
    }

    if (pollVoteLoadingById[pollId]) return;
    setPollVoteLoadingById((prev) => ({ ...prev, [pollId]: true }));

    try {
      const { error } = await supabase.from('poll_votes').insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: currentUserId,
      });

      if (error) {
        const duplicate =
          (error as { code?: string; message?: string }).code === '23505' ||
          /duplicate/i.test((error as { message?: string }).message || '');
        if (duplicate) {
          showToast('You already voted.');
        } else {
          throw error;
        }
      } else {
        setFeedMessages((prev) =>
          prev.map((m) => {
            if (m.pollId !== pollId) return m;
            const fallbackOptions =
              m.pollOptionStats && m.pollOptionStats.length > 0
                ? m.pollOptionStats
                : (m.pollOptions || []).map((text, idx) => ({
                    id: `${m.id}-${idx}`,
                    text,
                    votes: 0,
                  }));
            const updatedOptions = fallbackOptions.map((opt) =>
              opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt,
            );
            const totalVotes = (m.pollTotalVotes || 0) + 1;
            return {
              ...m,
              pollOptionStats: updatedOptions,
              pollTotalVotes: totalVotes,
              pollUserVoteOptionId: optionId,
            };
          }),
        );
        showToast('Vote counted.');
      }
    } catch (err) {
      console.error('[data] Failed to submit vote', err);
      showToast(`Failed to vote: ${friendlySupabaseError(err)}`);
    } finally {
      setPollVoteLoadingById((prev) => {
        const next = { ...prev };
        delete next[pollId];
        return next;
      });
    }
  };

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  const handleManualRefresh = useCallback(() => {
    if (actionLock || loadingPostsRef.current) return;
    startActionLock();
    void refreshLatestPhotoOfDay('manual');
    refreshFeed('manual');
  }, [actionLock, refreshFeed, refreshLatestPhotoOfDay, startActionLock]);

  const dismissInstallBanner = useCallback(() => {
    setShowInstallBanner(false);
    setInstallBannerDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('install-banner-dismissed', '1');
    }
  }, []);

  const closeInstallInstructions = useCallback(() => {
    setShowInstallInstructions(false);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (isStandalone) return;
    if (isIosBrowser || !installPromptEvent) {
      setShowInstallInstructions(true);
      return;
    }
    try {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstallPromptEvent(null);
        dismissInstallBanner();
      }
    } catch {
      setShowInstallInstructions(true);
    }
  }, [dismissInstallBanner, installPromptEvent, isIosBrowser, isStandalone]);

  const navigateTo = (view: View) => {
    if ((view === 'create' || view === 'personal') && !isAdmin) {
      showToast('Admin only.');
      setMenuOpen(false);
      return;
    }
    if (view === 'write') {
      setAdminMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })));
      setAdminInbox({ hasUnread: false, count: 0 });
    }
    if (view === 'home') {
      queueScrollToBottom();
    }
    setActiveView(view);
    setMenuOpen(false);
  };

  const goHome = () => {
    queueScrollToBottom();
    setActiveView('home');
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast('Sign-out unavailable.');
      return;
    }
    try {
      await supabase.auth.signOut();
      setIsSignedIn(false);
      setIsAdmin(false);
      setMenuOpen(false);
      setActiveView('home');
    } catch {
      showToast('Sign-out failed.');
    }
  };

  const openArtistMessage = () => {
    setAdminMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })));
    setActiveView('write');
    setMenuOpen(false);
    setAdminInbox({ hasUnread: false, count: 0 });
  };

  const sendMessage = async () => {
    const text = writeText.trim();
    if (!text) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast('Supabase is not configured.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id ?? null;
    if (!userId) {
      showToast('Sign in to send a message.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          thread_id: null,
          from_user_id: userId,
          to_admin_id: adminUserIdRef.current,
          body_text: text,
        })
        .select()
        .single();
      if (error) throw error;
      const mapped = mapDirectMessageRow(data as DirectMessageRow, adminUserIdRef.current);

      if (mapped.author === 'artist') {
        setAdminMessages((prev) => [
          ...prev,
          {
            id: mapped.id,
            author: 'Kareevsky',
            time: mapped.time,
            date: mapped.date,
            createdAt: mapped.createdAt,
            text: mapped.text,
            isUnread: false,
          },
        ]);
      } else {
        setPersonalMessages((prev) => [...prev, mapped]);
        setAdminInbox((prev) => ({ hasUnread: true, count: prev.count + 1 }));
      }
      showToast('Message sent.');
      setWriteText('');

      if (!isAdmin) {
        triggerPushEvent({
          eventType: 'user_dm_to_admin',
          messageText: text,
          deepLink: '/admin/messages',
        });
      }
    } catch (err) {
      console.error('[data] Failed to send direct message', err);
      showToast('Failed to send message. Please try again.');
    }
  };

  const startEditPost = (message: Message) => {
    if (!canEditPost(message)) return;
    closePostActionsMenu();
    setEditingPostId(message.id);
    setPostDrafts((prev) => ({ ...prev, [message.id]: prev[message.id] ?? message.text ?? '' }));
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
  };

  const savePostEdit = async (message: Message) => {
    const draft = (postDrafts[message.id] ?? message.text ?? '').trim();
    if (!draft) {
      showToast('Post text cannot be empty.');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || postsSource !== 'supabase') {
      showToast('Editing is available only when Supabase is configured.');
      return;
    }

    setPostSavingId(message.id);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ body_text: draft, updated_at: new Date().toISOString() })
        .eq('id', message.id)
        .eq('author_id', currentUserId || '');

      if (error) throw error;

      const updatedAt = new Date().toISOString();
      setFeedMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, text: draft, updatedAt } : m)),
      );
      setEditingPostId(null);
      showToast('Post updated.');
    } catch (err) {
      console.error('[data] Failed to update post', err);
      showToast('Failed to update post.');
    } finally {
      setPostSavingId(null);
    }
  };

  const deletePost = async (message: Message) => {
    if (!canDeletePost(message)) return;
    closePostActionsMenu();
    if (!window.confirm('Delete this post?')) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase || postsSource !== 'supabase') {
      showToast('Deleting is available only when Supabase is configured.');
      return;
    }

    setPostDeletingId(message.id);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', message.id)
        .eq('author_id', currentUserId || '');

      if (error) throw error;

      setFeedMessages((prev) => prev.filter((m) => m.id !== message.id));
      setCommentsByPostId((prev) => {
        const next = { ...prev };
        delete next[message.id];
        return next;
      });
      setEditingPostId((prev) => (prev === message.id ? null : prev));
      if (activeMessageId === message.id) {
        closeComments();
      }
      showToast('Post deleted.');
    } catch (err) {
      console.error('[data] Failed to delete post', err);
      showToast('Failed to delete post.');
    } finally {
      setPostDeletingId(null);
    }
  };

  const startEditDirectMessage = (msg: PersonalMessage) => {
    if (!canEditDirectMessage(msg)) return;
    closeDmActionsMenu();
    setEditingDmId(msg.id);
    setDmDrafts((prev) => ({ ...prev, [msg.id]: prev[msg.id] ?? msg.text }));
  };

  const cancelEditDirectMessage = () => {
    setEditingDmId(null);
  };

  const saveDirectMessageEdit = async (msg: PersonalMessage) => {
    if (!canEditDirectMessage(msg)) return;
    const draft = (dmDrafts[msg.id] ?? msg.text).trim();
    if (!draft) {
      showToast('Message cannot be empty.');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast('Supabase is required to edit messages.');
      return;
    }

    setDmSavingId(msg.id);
    try {
      const { error } = await supabase
        .from('direct_messages')
        .update({ body_text: draft, updated_at: new Date().toISOString() })
        .eq('id', msg.id)
        .eq('from_user_id', currentUserId || '');

      if (error) throw error;

      const updatedAt = new Date().toISOString();
      setPersonalMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, text: draft, updatedAt } : m)));
      setEditingDmId(null);
      showToast('Message updated.');
    } catch (err) {
      console.error('[data] Failed to edit direct message', err);
      showToast('Failed to edit message.');
    } finally {
      setDmSavingId(null);
    }
  };

  const deleteDirectMessage = async (msg: PersonalMessage) => {
    if (!canDeleteDirectMessage(msg)) return;
    closeDmActionsMenu();
    if (!window.confirm('Delete this message?')) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast('Supabase is required to delete messages.');
      return;
    }

    setDmDeletingId(msg.id);
    try {
      const { error } = await supabase
        .from('direct_messages')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', msg.id)
        .eq('from_user_id', currentUserId || '');

      if (error) throw error;

      setPersonalMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setEditingDmId((prev) => (prev === msg.id ? null : prev));
      showToast('Message deleted.');
    } catch (err) {
      console.error('[data] Failed to delete direct message', err);
      showToast('Failed to delete message.');
    } finally {
      setDmDeletingId(null);
    }
  };

  const handleTreat = (type: string) => {
    alert(
      `This would open an external donation/payment page (e.g. BuyMeACoffee / Payoneer) for: ${type}`,
    );
  };

  const toggleAudio = (audioId: string) => {
    setPlayingAudio(playingAudio === audioId ? null : audioId);
  };

  const preventReaderContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (isAdmin) return;
      event.preventDefault();
    },
    [isAdmin],
  );

  const resetMediaSelection = () => {
    setMediaFiles([]);
    setMediaPreviews([]);
    setMediaIsVideo(false);
  };

  const resetAudioSelection = () => {
    audioUploadRequestId.current += 1;
    if (audioUpload?.url && audioUpload.url.startsWith('blob:')) {
      URL.revokeObjectURL(audioUpload.url);
    }
    setAudioFile(null);
    setAudioUpload(null);
    setAudioUploading(false);
    setAudioUploadError(null);
  };

  const handleAudioSelect = async (file: File | null) => {
    audioUploadRequestId.current += 1;
    const requestId = audioUploadRequestId.current;

    setAudioUpload(null);
    setAudioUploadError(null);

    if (!file) {
      setAudioFile(null);
      setAudioUploading(false);
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setAudioFile(null);
      showToast('Please select an audio file.');
      return;
    }

    setAudioFile(file);
    setAudioUploading(true);

    try {
      const previewUrl = URL.createObjectURL(file);
      if (audioUploadRequestId.current !== requestId) {
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setAudioUpload({
        url: previewUrl,
        mimeType: file.type,
        size: file.size,
        filename: file.name,
        storagePath: 'pending',
      });
      showToast('Audio ready.');
    } catch (err) {
      if (audioUploadRequestId.current !== requestId) return;
      console.error(err);
      setAudioUpload(null);
      setAudioUploadError(err instanceof Error ? err.message : 'Failed to upload audio.');
      showToast('Failed to upload audio. Please try again.');
    } finally {
      if (audioUploadRequestId.current === requestId) {
        setAudioUploading(false);
      }
    }
  };

  const addMoreMedia = (newFiles: File[]) => {
    if (mediaIsVideo) {
      showToast('Video posts support only one file.', 2000);
      return;
    }
    if (mediaFiles.length + newFiles.length > 10) {
      showToast('Maximum 10 photos per post.', 2000);
      return;
    }
    const filtered = newFiles.filter((f) => f.type.startsWith('image/'));
    const newPreviews = filtered.map((f) => URL.createObjectURL(f));
    setMediaFiles((prev) => [...prev, ...filtered]);
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
  };

  const processMediaSelection = (files: File[]) => {
    if (files.length === 0) return;
    const firstVideo = files.find((f) => f.type.startsWith('video/'));
    if (firstVideo) {
      if (files.length > 1) {
        showToast('Video posts support one file at a time.', 2500);
      }
      setMediaIsVideo(true);
      setMediaFiles([firstVideo]);
      setMediaPreviews([URL.createObjectURL(firstVideo)]);
      return;
    }
    const filtered = files.filter((f) => f.type.startsWith('image/')).slice(0, 10);
    const previews = filtered.map((f) => URL.createObjectURL(f));
    setMediaIsVideo(false);
    setMediaFiles(filtered);
    setMediaPreviews(previews);
  };

  const removeMediaAtIndex = (idx: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== idx));
    if (mediaIsVideo) {
      setMediaIsVideo(false);
    }
  };

  const removePhotoDayAtIndex = (idx: number) => {
    setNewPhotoDayFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayPreviews((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayDescs((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayDates((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayTimes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateSave = async () => {
    if (!isAdmin) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast('Supabase is not configured.');
      return;
    }

    if (isSavingPost) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const authorId = sessionData?.session?.user?.id ?? null;
    if (!authorId) {
      showToast('Please sign in to publish.');
      return;
    }
    setIsSavingPost(true);
    const timeLabel = formatShortTime();

    try {
      if (createTab === 'text') {
        if (!createTextTitle.trim() && !createTextBody.trim()) return;
        const body = createTextBody.trim() || createTextTitle.trim();
        const { data, error } = await supabase
          .from('posts')
          .insert({
            author_id: authorId,
            type: 'text',
            title: createTextTitle.trim() || null,
            body_text: body,
            visibility: 'public',
            metadata: { time_label: timeLabel },
          })
          .select()
          .single();
        if (error) throw error;
        const newPostId = (data as PostRow).id;
        const mapped = mapPostRowToMessage({ ...(data as PostRow), post_media: [], comments: [] }, adminUserIdRef.current);
        setFeedMessages((prev) => [...prev, mapped]);
        queueScrollToBottom({ force: true });
        triggerPushEvent({
          eventType: 'admin_new_post',
          postId: newPostId,
          messageText: createTextTitle.trim() || createTextBody.trim(),
          deepLink: '/?open=latest',
        });
        showToast('Text post published.');
        setCreateTextTitle('');
        setCreateTextBody('');
      } else if (createTab === 'media') {
        if (mediaFiles.length === 0) {
          showToast('Add a photo or video first.');
          return;
        }

        const mediaType: MediaKind = mediaIsVideo ? 'video' : 'image';
        let newPostId: string | null = null;
        const uploadedPaths: string[] = [];

        try {
          const baseMetadata = {
            caption: mediaCaption.trim() || null,
            time_label: timeLabel,
          };

          const { data: postData, error: postError } = await supabase
            .from('posts')
            .insert({
              author_id: authorId,
              type: mediaIsVideo ? 'video' : 'photo',
              body_text: mediaCaption.trim() || null,
              visibility: 'public',
              metadata: baseMetadata,
            })
            .select()
            .single();
          if (postError) throw postError;

          newPostId = (postData as PostRow).id;

          const mediaMetadata = await Promise.all(mediaFiles.map((file) => extractMediaMetadata(file, mediaType)));
          const uploads = await Promise.all(
            mediaFiles.map((file) =>
              uploadMedia(file, mediaType, {
                bucket: MEDIA_BUCKET,
                postId: newPostId as string,
                preferSignedUrl: true,
              }),
            ),
          );
          uploads.forEach((u) => uploadedPaths.push(u.storagePath));

          const mediaRows = uploads.map((u, idx) => ({
            post_id: newPostId,
            storage_path: u.storagePath,
            media_type: mediaType,
            width: mediaMetadata[idx]?.width ?? null,
            height: mediaMetadata[idx]?.height ?? null,
            duration: mediaMetadata[idx]?.duration ?? null,
          }));

          const { data: mediaData, error: mediaError } = await supabase.from('post_media').insert(mediaRows).select();
          if (mediaError) throw mediaError;
          const insertedMedia = (mediaData as PostMediaRow[]) || mediaRows;
          const resolvedMedia = await resolveMediaWithUrls(insertedMedia);

          const imageUrls = !mediaIsVideo ? resolvedMedia.map((m) => m.url || m.storage_path) : undefined;
          const videoUrl = mediaIsVideo ? resolvedMedia[0]?.url || resolvedMedia[0]?.storage_path : undefined;
          let imagePreviewUrls: string[] | undefined;
          let imagePreviewPaths: string[] | undefined;
          let videoPosterUrl: string | undefined;
          let videoPosterPath: string | undefined;

          // Generate lightweight previews/posters once at upload time (not at feed view time).
          try {
            if (!mediaIsVideo) {
              const previewFiles = await Promise.all(mediaFiles.map((file) => createImagePreviewFile(file)));
              const previewUploads = await Promise.all(
                previewFiles.map((preview) =>
                  preview
                    ? uploadMedia(preview, 'image', {
                        bucket: MEDIA_BUCKET,
                        postId: newPostId as string,
                        preferSignedUrl: true,
                      })
                    : Promise.resolve(null),
                ),
              );
              const ok = previewUploads.filter(Boolean) as MediaUploadResult[];
              if (ok.length > 0) {
                ok.forEach((u) => uploadedPaths.push(u.storagePath));
                imagePreviewUrls = ok.map((u) => u.url);
                imagePreviewPaths = ok.map((u) => u.storagePath);
              }
            } else {
              const posterFile = await createVideoPosterFromMiddle(mediaFiles[0] as File);
              if (posterFile) {
                const posterUpload = await uploadMedia(posterFile, 'image', {
                  bucket: MEDIA_BUCKET,
                  postId: newPostId as string,
                  preferSignedUrl: true,
                });
                uploadedPaths.push(posterUpload.storagePath);
                videoPosterUrl = posterUpload.url;
                videoPosterPath = posterUpload.storagePath;
              }
            }
          } catch (previewErr) {
            // Best-effort only: continue without previews/poster.
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[media-upload] Preview/poster generation failed (continuing).', previewErr);
            }
          }

          const { data: updatedPost, error: updateError } = await supabase
            .from('posts')
            .update({
              metadata: {
                ...baseMetadata,
                image_urls: imageUrls,
                image_preview_urls: imagePreviewUrls,
                image_preview_paths: imagePreviewPaths,
                video_url: videoUrl,
                video_poster_url: videoPosterUrl,
                video_poster_path: videoPosterPath,
              },
            })
            .eq('id', newPostId)
            .select()
            .single();
          if (updateError) throw updateError;

          const mapped = mapPostRowToMessage(
            { ...(updatedPost as PostRow), post_media: resolvedMedia, comments: [] },
            adminUserIdRef.current,
          );
          setFeedMessages((prev) => [...prev, mapped]);
          queueScrollToBottom({ force: true });
          triggerPushEvent({
            eventType: 'admin_new_post',
            postId: newPostId as string,
            messageText: mediaCaption.trim() || undefined,
            deepLink: '/?open=latest',
          });
          showToast(mediaIsVideo ? 'Video post published.' : `Photo post with ${uploads.length} image(s) published.`);
          setMediaFiles([]);
          setMediaPreviews([]);
          setMediaCaption('');
          setMediaIsVideo(false);
        } catch (err) {
          console.error('[media-upload] Failed to upload media post', err);
          await cleanupPostAndMedia(newPostId, uploadedPaths);
          throw err;
        }
      } else if (createTab === 'audio') {
        if (audioUploading) {
          showToast('Please wait for the audio upload to finish.');
          return;
        }
        if (!audioFile) {
          showToast('Upload an audio file first.');
          return;
        }
        let newPostId: string | null = null;
        const uploadedPaths: string[] = [];

        try {
          const audioMetadata = await extractMediaMetadata(audioFile, 'audio');

          const { data: postData, error: postError } = await supabase
            .from('posts')
            .insert({
              author_id: authorId,
              type: 'audio',
              body_text: audioFile.name || 'Audio message',
              visibility: 'public',
              metadata: {
                time_label: timeLabel,
              },
            })
            .select()
            .single();
          if (postError) throw postError;

          newPostId = (postData as PostRow).id;

          const uploaded = await uploadMedia(audioFile, 'audio', {
            bucket: MEDIA_BUCKET,
            postId: newPostId as string,
            preferSignedUrl: true,
          });
          uploadedPaths.push(uploaded.storagePath);

          const mediaRow = {
            post_id: newPostId,
            storage_path: uploaded.storagePath,
            media_type: 'audio' as const,
            width: null,
            height: null,
            duration: audioMetadata.duration ?? null,
          };

          const { data: mediaData, error: mediaError } = await supabase
            .from('post_media')
            .insert(mediaRow)
            .select();
          if (mediaError) throw mediaError;

          const insertedMedia = (mediaData as PostMediaRow[]) || [mediaRow];
          const resolvedMedia = await resolveMediaWithUrls(insertedMedia);
          const audioUrl = resolvedMedia[0]?.url || resolvedMedia[0]?.storage_path || uploaded.url;

          const { data: updatedPost, error: updateError } = await supabase
            .from('posts')
            .update({
              metadata: {
                audio_url: audioUrl,
                time_label: timeLabel,
              },
            })
            .eq('id', newPostId)
            .select()
            .single();
          if (updateError) throw updateError;

          const mapped = mapPostRowToMessage(
            { ...(updatedPost as PostRow), post_media: resolvedMedia, comments: [] },
            adminUserIdRef.current,
          );
          setFeedMessages((prev) => [...prev, mapped]);
          queueScrollToBottom({ force: true });
          triggerPushEvent({
            eventType: 'admin_new_post',
            postId: newPostId as string,
            messageText: audioFile.name || 'Audio post',
            deepLink: '/?open=latest',
          });
          showToast('Audio post published.');
          resetAudioSelection();
        } catch (err) {
          await cleanupPostAndMedia(newPostId, uploadedPaths);
          throw err;
        }
      } else if (createTab === 'poll') {
        const pollQuestionText = pollQuestion.trim();
        const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (!pollQuestionText) {
          showToast('Add a poll question.');
          return;
        }
        if (trimmedOptions.length < 2) {
          showToast('Add at least two options.');
          return;
        }
        let newPostId: string | null = null;
        let newPollId: string | null = null;
        try {
          const { data: postData, error: postError } = await supabase
            .from('posts')
            .insert({
              author_id: authorId,
              type: 'poll',
              body_text: pollQuestionText,
              visibility: 'public',
              metadata: {
                poll_question: pollQuestionText,
                poll_options: trimmedOptions.slice(0, 4),
                time_label: timeLabel,
              },
            })
            .select()
            .single();
          if (postError) throw postError;

          newPostId = (postData as PostRow).id;
          const { data: pollData, error: pollError } = await supabase
            .from('polls')
            .insert({
              post_id: newPostId,
              question: pollQuestionText,
            })
            .select()
            .single();
          if (pollError) throw pollError;

          newPollId = (pollData as PollRow).id;

          const optionsToInsert = trimmedOptions.slice(0, 4).map((opt) => ({
            poll_id: newPollId as string,
            option_text: opt,
          }));

          const { data: insertedOptions, error: optionsError } = await supabase
            .from('poll_options')
            .insert(optionsToInsert)
            .select();
          if (optionsError) throw optionsError;

          const { data: updatedPost, error: updateError } = await supabase
            .from('posts')
            .update({
              metadata: {
                poll_id: newPollId,
                poll_question: pollQuestionText,
                poll_options: trimmedOptions.slice(0, 4),
                time_label: timeLabel,
              },
            })
            .eq('id', newPostId)
            .select()
            .single();
          if (updateError) throw updateError;

          const optionStats: PollOptionStats[] = ((insertedOptions as PollOptionRow[]) || []).map((opt) => ({
            id: opt.id,
            text: opt.option_text || '',
            votes: 0,
          }));

          const pollDataByPostId: PollDataByPostId = {
            [newPostId]: {
              pollId: newPollId as string,
              question: pollQuestionText,
              options: optionStats,
              totalVotes: 0,
              userVoteOptionId: null,
            },
          };

          const mapped = mapPostRowToMessage(
            { ...(updatedPost as PostRow), post_media: [], comments: [] },
            adminUserIdRef.current,
            pollDataByPostId,
          );

          setFeedMessages((prev) => [...prev, mapped]);
          queueScrollToBottom({ force: true });
          triggerPushEvent({
            eventType: 'admin_new_post',
            postId: newPostId,
            messageText: pollQuestionText,
            deepLink: '/?open=latest',
          });
          showToast('Poll published.');
          setPollQuestion('');
          setPollOptions(['', '']);
        } catch (pollErr) {
          if (newPollId) {
            await supabase.from('polls').delete().eq('id', newPollId);
          }
          if (newPostId) {
            await cleanupPostAndMedia(newPostId, []);
          }
          throw pollErr;
        }
      } else if (createTab === 'languages') {
        const langs: I18nLang[] = ['en', 'es', 'fr', 'it'];

        if (i18nMode === 'text') {
          const trimmed = langs.map((l) => [l, i18nTexts[l].trim()] as const);
          const english = trimmed.find(([l]) => l === 'en');
          if (!english || !english[1]) {
            showToast('Please provide English text.');
            return;
          }
          const items: I18nItem[] = trimmed
            .filter(([, t]) => t.length > 0)
            .map(([lang, text]) => ({ lang, text }));
          const pack: I18nPack = { mode: 'text', items };
          const { data, error } = await supabase
            .from('posts')
            .insert({
              author_id: authorId,
              type: 'i18n',
              body_text: 'i18n',
              visibility: 'public',
              metadata: { i18n_pack: pack, time_label: timeLabel },
            })
            .select()
            .single();
          if (error) throw error;
          const mapped = mapPostRowToMessage({ ...(data as PostRow), post_media: [], comments: [] }, adminUserIdRef.current);
          setFeedMessages((prev) => [...prev, mapped]);
          queueScrollToBottom({ force: true });
          triggerPushEvent({
            eventType: 'admin_new_post',
            postId: (data as PostRow).id,
            messageText: english ? english[1] : 'New post',
            deepLink: '/?open=latest',
          });
          showToast('Multi-language post published.');
          setI18nTexts({ en: '', es: '', fr: '', it: '' });
        } else {
          const uploadsByLang: Record<I18nLang, string[]> = { en: [], es: [], fr: [], it: [] };
          for (const lang of langs) {
            const files = i18nFiles[lang] || [];
            if (files.length === 0) continue;
            const uploads = await Promise.all(files.map((file) => uploadMedia(file, 'image')));
            uploadsByLang[lang] = uploads.map((u) => u.url);
          }
          const withImages = langs
            .map((lang) => ({ lang, urls: uploadsByLang[lang] || [] }))
            .filter(({ urls }) => urls.length > 0);
          const hasEnglish = withImages.some(({ lang }) => lang === 'en');
          if (!hasEnglish) {
            showToast('Please upload at least English images.');
            return;
          }
          const items: I18nItem[] = withImages.map(({ lang, urls }) => ({
            lang,
            imageUrl: urls[0],
            imageUrls: [...urls],
          }));
          const pack: I18nPack = { mode: 'screenshot', items };
          const { data, error } = await supabase
            .from('posts')
            .insert({
              author_id: authorId,
              type: 'i18n',
              body_text: 'i18n',
              visibility: 'public',
              metadata: { i18n_pack: pack, time_label: timeLabel },
            })
            .select()
            .single();
          if (error) throw error;
          const mapped = mapPostRowToMessage({ ...(data as PostRow), post_media: [], comments: [] }, adminUserIdRef.current);
          setFeedMessages((prev) => [...prev, mapped]);
          queueScrollToBottom({ force: true });
          triggerPushEvent({
            eventType: 'admin_new_post',
            postId: (data as PostRow).id,
            messageText: 'New media post',
            deepLink: '/?open=latest',
          });
          showToast('Multi-language post published.');
          setI18nFiles({ en: [], es: [], fr: [], it: [] });
          setI18nPreviews({ en: [], es: [], fr: [], it: [] });
        }
      } else {
        showToast('Saved.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[data] Failed to save post', err);
      const toastMessage =
        createTab === 'media'
          ? `Failed to save media post: ${friendlySupabaseError(err) || errorMessage}`
          : `Failed to save post: ${friendlySupabaseError(err) || errorMessage}`;
      showToast(toastMessage);
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleAddPhotoDaySave = async () => {
    if (!isAdmin) return;
    if (newPhotoDayFiles.length === 0) return;
    if (photoOfDayPublishing) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast('Supabase is not configured.');
      return;
    }

    setPhotoOfDayPublishing(true);
    try {
      const userId = currentUserId;
      if (!userId) {
        showToast('Please sign in to publish.');
        return;
      }

      // Preflight: fail fast (RLS/table missing) before uploading files.
      const { error: accessError } = await supabase.from(PHOTO_OF_DAY_TABLE).select('id').limit(1);
      if (accessError) {
        throw accessError;
      }

      showToast('Publishing…', 1500);

      const uploads = await Promise.all(
        newPhotoDayFiles.map((file) => uploadMedia(file, 'image', { bucket: MEDIA_BUCKET, preferSignedUrl: true })),
      );
      const insertRows = uploads.map((u, i) => ({
        image_path: u.storagePath,
        caption: (newPhotoDayDescs[i] || '').trim() || null,
        created_by: userId,
      }));

      const { error: insertError } = await supabase.from(PHOTO_OF_DAY_TABLE).insert(insertRows);
      if (insertError) {
        // Best-effort cleanup of orphaned uploads when the DB insert fails.
        try {
          await supabase.storage.from(MEDIA_BUCKET).remove(uploads.map((u) => u.storagePath));
        } catch {
          // ignore cleanup failures
        }
        throw insertError;
      }

      setAddPhotoDayOpen(false);
      setNewPhotoDayFiles([]);
      setNewPhotoDayPreviews([]);
      setNewPhotoDayDescs([]);
      setNewPhotoDayDates([]);
      setNewPhotoDayTimes([]);

      showToast(`${insertRows.length} Photo(s) of the Day published.`);
      await refreshLatestPhotoOfDay('manual');
    } catch (err) {
      console.error('[photo-of-day] Failed to publish', err);
      showToast(`Failed to publish photo: ${friendlyPhotoOfDayError(err)}`);
    } finally {
      setPhotoOfDayPublishing(false);
    }
  };

  const handleSendComment = async () => {
    if (!activeMessageId) return;
    const text = commentReply.trim();
    if (!text) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase || postsSource === 'mock') {
      setCommentsByPostId((prev) => {
        const existing = prev[activeMessageId] ?? fakeComments;
        return {
          ...prev,
          [activeMessageId]: [...existing, { id: `c-${Date.now()}`, author: 'Kareevsky', text }],
        };
      });
      setCommentReply('');
      showToast('Reply saved locally.');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;
      if (!userId) {
        showToast('Sign in to comment.');
        return;
      }
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: activeMessageId,
          user_id: userId,
          body_text: text,
        })
        .select()
        .single();
      if (error) throw error;
      const mapped = mapCommentRow(data as CommentRow, adminUserIdRef.current);
      setCommentsByPostId((prev) => {
        const existing = prev[activeMessageId] ?? [];
        return {
          ...prev,
          [activeMessageId]: [...existing, mapped],
        };
      });
      setCommentReply('');
      showToast('Reply published.');

      if (!isAdmin) {
        triggerPushEvent({
          eventType: 'new_comment_to_admin',
          postId: activeMessageId,
          commentText: text,
          deepLink: activeMessageId ? `/?open=post&postId=${activeMessageId}` : undefined,
        });
      }
    } catch (err) {
      console.error('[data] Failed to send comment', err);
      showToast('Failed to send comment.');
    }
  };

  const startEditComment = (comment: Comment) => {
    if (!canEditComment(comment)) return;
    closeCommentActionsMenu();
    setEditingCommentId(comment.id);
    setCommentDrafts((prev) => ({ ...prev, [comment.id]: prev[comment.id] ?? comment.text }));
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
  };

  const saveCommentEdit = async (comment: Comment) => {
    if (!canEditComment(comment)) return;
    const postId = comment.postId || activeMessageId;
    const draft = (commentDrafts[comment.id] ?? comment.text).trim();
    if (!draft) {
      showToast('Comment cannot be empty.');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || postsSource === 'mock') {
      showToast('Supabase is required to edit comments.');
      return;
    }

    setCommentSavingId(comment.id);
    try {
      const { error } = await supabase
        .from('comments')
        .update({ body_text: draft, updated_at: new Date().toISOString() })
        .eq('id', comment.id)
        .eq('user_id', currentUserId || '');

      if (error) throw error;

      const updatedAt = new Date().toISOString();
      if (postId) {
        setCommentsByPostId((prev) => {
          const existing = prev[postId] || [];
          return {
            ...prev,
            [postId]: existing.map((c) => (c.id === comment.id ? { ...c, text: draft, updatedAt } : c)),
          };
        });
      }
      setEditingCommentId(null);
      showToast('Comment updated.');
    } catch (err) {
      console.error('[data] Failed to edit comment', err);
      showToast('Failed to edit comment.');
    } finally {
      setCommentSavingId(null);
    }
  };

  const deleteComment = async (comment: Comment) => {
    if (!canDeleteComment(comment)) return;
    closeCommentActionsMenu();
    if (!window.confirm('Delete this comment?')) return;
    const postId = comment.postId || activeMessageId;
    const supabase = getSupabaseBrowserClient();
    if (!supabase || postsSource === 'mock') {
      showToast('Supabase is required to delete comments.');
      return;
    }

    setCommentDeletingId(comment.id);
    try {
      let query = supabase
        .from('comments')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', comment.id);

      if (!isAdmin) {
        query = query.eq('user_id', currentUserId || '');
      }

      const { error } = await query;
      if (error) throw error;

      if (postId) {
        setCommentsByPostId((prev) => {
          const existing = prev[postId] || [];
          const filtered = existing.filter((c) => c.id !== comment.id);
          const next = { ...prev, [postId]: filtered };
          if (filtered.length === 0) {
            delete next[postId];
          }
          return next;
        });
      }
      setEditingCommentId((prev) => (prev === comment.id ? null : prev));
      showToast('Comment deleted.');
    } catch (err) {
      console.error('[data] Failed to delete comment', err);
      showToast('Failed to delete comment.');
    } finally {
      setCommentDeletingId(null);
    }
  };

  const hasUnreadAdminMessage = adminMessages.some((m) => m.isUnread);

  const renderWithDateDividers = <T extends { id: string; createdAt?: string }>(
    list: T[],
    renderItem: (item: T) => React.ReactNode,
    keyPrefix: string,
  ) => {
    const nodes: React.ReactNode[] = [];
    let prevDate: string | undefined;
    list.forEach((item, idx) => {
      const label = formatDayLabel(item.createdAt);
      if (!prevDate || !isSameDay(item.createdAt, prevDate)) {
        nodes.push(
          <div key={`${keyPrefix}-date-${item.id}-${idx}`} className="date-pill date-pill--paper">
            {label}
          </div>,
        );
        prevDate = item.createdAt || prevDate;
      }
      nodes.push(<React.Fragment key={`${keyPrefix}-${item.id}`}>{renderItem(item)}</React.Fragment>);
    });
    return nodes;
  };

  const renderConversationView = () => (
    <div className="app-container write-view">
      <header className="view-header">
        <button className="view-header__back" onClick={goHome}>
          {Icons.back}
        </button>
        <div className="view-header__title">
          <span>Write to Kareevsky</span>
          {adminInbox.hasUnread && (
            <span className="badge badge--alert" style={{ marginLeft: '8px' }}>
              {adminInbox.count > 0 ? adminInbox.count : ''}
            </span>
          )}
        </div>
      </header>
      <div className="write-view__paper">
        <div className="message" style={{ marginLeft: 0, maxWidth: '100%' }}>
          <div className="message__time" style={{ fontFamily: 'var(--font-ui)' }}>
            Letters from Kareevsky
          </div>
          {adminMessages.map((msg) => (
            <div
              key={msg.id}
              className="message__bubble message__bubble--text"
              style={{ marginBottom: '8px' }}
            >
              <p className="message__handwriting">{msg.text}</p>
              <div className="message__meta" style={{ right: '16px' }}>
                {msg.date ? `${msg.date} • ${msg.time}` : msg.time}
              </div>
            </div>
          ))}
        </div>
        {personalMessages.map((msg) => {
          const isArtist = msg.author === 'artist';
          const canEditMsg = canEditDirectMessage(msg);
          const canDeleteMsg = canDeleteDirectMessage(msg);
          const isEditing = editingDmId === msg.id;
          const showDmMenu = (canEditMsg || canDeleteMsg) && !isEditing;
          const dmMenuOpen = dmActionsOpenId === msg.id;
          const draftValue = dmDrafts[msg.id] ?? msg.text;
          return (
            <div
              key={msg.id}
              className="message"
              style={{
                marginLeft: isArtist ? 'var(--space-md)' : 'auto',
                marginRight: isArtist ? undefined : 'var(--space-md)',
              }}
            >
              {showDmMenu && (
                <div
                  className="post-actions-menu post-actions-menu--dm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="post-actions-menu__trigger"
                    aria-haspopup="menu"
                    aria-expanded={dmMenuOpen}
                    aria-label="Direct message actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDmActionsMenu(msg.id);
                    }}
                  >
                    ⋮
                  </button>
                  {dmMenuOpen && (
                    <div className="post-actions-menu__list" role="menu">
                      {canEditMsg && (
                        <button
                          type="button"
                          className="post-actions-menu__item"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditDirectMessage(msg);
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteMsg && (
                        <button
                          type="button"
                          className="post-actions-menu__item post-actions-menu__item--danger"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDirectMessage(msg);
                          }}
                          disabled={dmDeletingId === msg.id}
                        >
                          {dmDeletingId === msg.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="message__bubble message__bubble--text">
                {isEditing ? (
                  <>
                    <textarea
                      value={draftValue}
                      onChange={(e) =>
                        setDmDrafts((prev) => ({
                          ...prev,
                          [msg.id]: e.target.value,
                        }))
                      }
                      className="write-view__textarea"
                      style={{ minHeight: '100px', padding: '10px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="inline-btn"
                        onClick={() => saveDirectMessageEdit(msg)}
                        disabled={dmSavingId === msg.id}
                      >
                        {dmSavingId === msg.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="inline-btn inline-btn--ghost"
                        onClick={cancelEditDirectMessage}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="message__handwriting">{msg.text}</p>
                )}
                <div className="message__meta">
                  {msg.date ? `${msg.date} • ${msg.time}` : msg.time}
                  {msg.updatedAt && <span style={{ marginLeft: '6px' }}>(edited)</span>}
                </div>
              </div>
            </div>
          );
        })}
        <textarea
          className="write-view__textarea"
          placeholder={session ? "What's on your mind..." : 'Sign in to write.'}
          value={writeText}
          onChange={(e) => {
            if (!session) return;
            setWriteText(e.target.value);
          }}
          disabled={!session}
        />
      </div>
      {session && (
        <div className="write-view__footer">
          <button className="write-view__send" onClick={sendMessage}>
            Send
          </button>
        </div>
      )}
    </div>
  );

  const renderCreateTabs = () => {
    const tabs: { key: typeof createTab; label: string }[] = [
      { key: 'text', label: 'Text' },
      { key: 'media', label: 'Photo / Video' },
      { key: 'audio', label: 'Audio' },
      { key: 'poll', label: 'Poll' },
      { key: 'languages', label: '🌍 Languages' },
    ];
    return (
      <div className="create-tabs create-tabs--5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`create-tab ${createTab === tab.key ? 'create-tab--active' : ''}`}
            onClick={() => setCreateTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  const renderCreateContent = () => {
    if (createTab === 'text') {
      return (
        <div className="create-section">
          <label className="create-label">Title</label>
          <input
            value={createTextTitle}
            onChange={(e) => setCreateTextTitle(e.target.value)}
            className="create-input"
            placeholder="Title"
          />
          <label className="create-label">Text</label>
          <textarea
            value={createTextBody}
            onChange={(e) => setCreateTextBody(e.target.value)}
            className="write-view__textarea"
            style={{ minHeight: '200px', padding: '12px' }}
            placeholder="Write the post..."
          />
        </div>
      );
    }

    if (createTab === 'media') {
      return (
        <div className="create-section">
          <label className="create-label">Upload photos or video (photos 1-10, video x1)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                if (mediaFiles.length === 0) {
                  processMediaSelection(files);
                } else {
                  addMoreMedia(files);
                }
              }
              // Reset input so same file can be selected again
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="create-input"
            style={{ display: mediaFiles.length > 0 ? 'none' : 'block' }}
          />
          {mediaFiles.length > 0 && (
            <div className="create-card">
              <div className="create-file-name">
                {mediaIsVideo
                  ? `${mediaFiles[0].name} (video)`
                  : `${mediaFiles.length} photo${mediaFiles.length !== 1 ? 's' : ''} selected`}
                {!mediaIsVideo && mediaFiles.length < 10 && (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>(max 10)</span>
                )}
              </div>
              <div className="create-previews-grid" style={{ gridTemplateColumns: mediaIsVideo ? '1fr' : undefined }}>
                {mediaPreviews.map((src, i) => (
                  <div key={i} className="create-preview-wrapper">
                    {mediaIsVideo ? (
                      <video
                        src={src}
                        controls
                        playsInline
                        preload="metadata"
                        className="create-preview-img"
                        style={{ objectFit: 'contain' }}
                      />
                    ) : (
                      <img src={src} alt="" className="create-preview-img" />
                    )}
                    <button
                      type="button"
                      className="create-preview-remove"
                      onClick={() => removeMediaAtIndex(i)}
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!mediaIsVideo && mediaFiles.length < 10 && (
                  <button
                    type="button"
                    className="create-preview-add"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add more photos"
                  >
                    {Icons.plus}
                  </button>
                )}
              </div>
              <label className="create-label" style={{ marginTop: '12px' }}>Caption (optional)</label>
              <textarea
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                className="create-input"
                placeholder="Add a caption for this post..."
                rows={2}
                style={{ resize: 'none' }}
              />
            </div>
          )}
        </div>
      );
    }

    if (createTab === 'audio') {
      return (
        <div className="create-section">
          <label className="create-label">Upload audio</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void handleAudioSelect(file);
                  if (e.target) e.target.value = '';
            }}
            className="create-input"
          />
              {audioUploading && <div className="create-note">Uploading audio...</div>}
              {audioUpload?.url && (
                <div className="create-file-name">Uploaded: {audioUpload.filename}</div>
              )}
              {audioUploadError && !audioUploading && (
                <div className="create-note" style={{ color: '#ef4444' }}>
                  {audioUploadError}
                </div>
              )}
              {!audioUploading && !audioUpload && audioFile && !audioUploadError && (
                <div className="create-note">Audio selected. Preparing upload...</div>
              )}
          <div className="create-card" style={{ opacity: 0.6 }}>
            <button className="create-tab" disabled>
              Record (soon)
            </button>
            <div className="create-note">Real in-app recording will be added later.</div>
          </div>
        </div>
      );
    }

    if (createTab === 'poll') {
      return (
        <div className="create-section">
          <label className="create-label">Question</label>
          <input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            className="create-input"
            placeholder="Question"
          />
          <div className="create-label" style={{ marginTop: '8px' }}>
            Options
          </div>
          {pollOptions.map((opt, idx) => (
            <input
              key={idx}
              value={opt}
              onChange={(e) => {
                const next = [...pollOptions];
                next[idx] = e.target.value;
                setPollOptions(next);
              }}
              className="create-input"
              placeholder={`Option ${idx + 1}`}
              style={{ marginTop: '4px' }}
            />
          ))}
          {pollOptions.length < 5 && (
            <button
              className="create-tab"
              style={{ marginTop: '8px' }}
              onClick={() => setPollOptions((prev) => [...prev, ''])}
            >
              Add option
            </button>
          )}
        </div>
      );
    }

    if (createTab === 'languages') {
      const languages: { code: I18nLang; label: string; flag: string }[] = [
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'es', label: 'Spanish', flag: '🇪🇸' },
        { code: 'fr', label: 'French', flag: '🇫🇷' },
        { code: 'it', label: 'Italian', flag: '🇮🇹' },
      ];

      const handleI18nFileSelect = (lang: I18nLang, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const accepted = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (accepted.length === 0) return;
        const sortedNewFiles = sortFilesByLastModifiedAsc(accepted);
        const newPreviews = sortedNewFiles.map((f) => URL.createObjectURL(f));
        setI18nFiles((prev) => ({ ...prev, [lang]: [...(prev[lang] || []), ...sortedNewFiles] }));
        setI18nPreviews((prev) => ({ ...prev, [lang]: [...(prev[lang] || []), ...newPreviews] }));
      };

      const removeI18nImage = (lang: I18nLang, idx: number) => {
        setI18nFiles((prev) => ({
          ...prev,
          [lang]: (prev[lang] || []).filter((_, i) => i !== idx),
        }));
        setI18nPreviews((prev) => ({
          ...prev,
          [lang]: (prev[lang] || []).filter((_, i) => i !== idx),
        }));
      };

      const moveI18nImage = (lang: I18nLang, idx: number, direction: -1 | 1) => {
        setI18nFiles((prev) => {
          const list = [...(prev[lang] || [])];
          const target = idx + direction;
          if (target < 0 || target >= list.length) return prev;
          [list[idx], list[target]] = [list[target], list[idx]];
          return { ...prev, [lang]: list };
        });
        setI18nPreviews((prev) => {
          const list = [...(prev[lang] || [])];
          const target = idx + direction;
          if (target < 0 || target >= list.length) return prev;
          [list[idx], list[target]] = [list[target], list[idx]];
          return { ...prev, [lang]: list };
        });
      };

      return (
        <div className="create-section">
          <label className="create-label">Multi-Language Post</label>
          <p className="create-note" style={{ marginBottom: '12px' }}>
            Create a single post with content in 4 languages. All 4 languages are required.
          </p>

          {/* Mode Selector */}
          <div className="i18n-mode-selector">
            <button
              type="button"
              className={`i18n-mode-btn ${i18nMode === 'text' ? 'i18n-mode-btn--active' : ''}`}
              onClick={() => setI18nMode('text')}
            >
              💬 Text Bubbles
            </button>
            <button
              type="button"
              className={`i18n-mode-btn ${i18nMode === 'screenshot' ? 'i18n-mode-btn--active' : ''}`}
              onClick={() => setI18nMode('screenshot')}
            >
              📷 Screenshots
            </button>
          </div>

          <p className="create-note" style={{ marginTop: '8px', marginBottom: '16px' }}>
            {i18nMode === 'text'
              ? 'Enter text for each language. Will show as 4 stacked message bubbles.'
              : 'Upload an image for each language. Will show as a carousel.'}
          </p>

          {/* Language Entries */}
          <div className="i18n-entries">
            {languages.map(({ code, label, flag }) => (
              <div key={code} className="i18n-entry">
                <div className="i18n-entry__header">
                  <span className="i18n-entry__flag">{flag}</span>
                  <span className="i18n-entry__label">{label}</span>
                  <span className="i18n-entry__code">{code.toUpperCase()}</span>
                </div>
                 {i18nMode === 'text' ? (
                   <textarea
                     value={i18nTexts[code]}
                     onChange={(e) => setI18nTexts((prev) => ({ ...prev, [code]: e.target.value }))}
                     className="i18n-entry__textarea"
                     placeholder={`Enter ${label} text...`}
                     rows={3}
                   />
                 ) : (
                   <div className="i18n-entry__upload">
                     <div className="i18n-preview-list">
                       {(i18nPreviews[code] || []).map((preview, idx) => (
                         <div key={`${code}-${idx}`} className="i18n-preview-wrapper">
                           <img src={preview} alt={`${label} preview ${idx + 1}`} className="i18n-preview-img" />
                           <div className="i18n-preview-actions">
                             <button
                               type="button"
                               className="i18n-preview-move"
                               onClick={() => moveI18nImage(code, idx, -1)}
                               disabled={idx === 0}
                               aria-label="Move up"
                             >
                               ↑
                             </button>
                             <button
                               type="button"
                               className="i18n-preview-move"
                               onClick={() => moveI18nImage(code, idx, 1)}
                               disabled={idx === (i18nPreviews[code]?.length || 0) - 1}
                               aria-label="Move down"
                             >
                               ↓
                             </button>
                             <button
                               type="button"
                               className="i18n-preview-remove"
                               onClick={() => removeI18nImage(code, idx)}
                               aria-label="Remove image"
                             >
                               ×
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                     <button
                       type="button"
                       className="i18n-upload-btn"
                       onClick={() => i18nFileInputRefs.current[code]?.click()}
                     >
                       {Icons.plus}
                       <span>{(i18nPreviews[code] || []).length ? 'Add more' : `Upload ${label}`}</span>
                     </button>
                     <input
                       ref={(el) => {
                         i18nFileInputRefs.current[code] = el;
                       }}
                       type="file"
                       accept="image/*"
                       multiple
                       style={{ display: 'none' }}
                       onChange={(e) => {
                         const fileList = e.target.files || null;
                         handleI18nFileSelect(code, fileList);
                         if (e.target) e.target.value = '';
                       }}
                     />
                   </div>
                 )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderCreateView = () => {
    if (!isAdmin) {
      return (
        <div className="app-container">
          <header className="view-header">
            <button className="view-header__back" onClick={goHome}>
              {Icons.back}
            </button>
            <h1 className="view-header__title">New post</h1>
          </header>
          <div className="feed" style={{ paddingTop: '12px' }}>
            <div className="empty-state">
              <div className="empty-state__title">Admin only</div>
              <div className="empty-state__subtitle">Sign in with the admin email to create posts.</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app-container">
        <header className="view-header">
          <button className="view-header__back" onClick={goHome}>
            {Icons.back}
          </button>
          <h1 className="view-header__title">New post</h1>
        </header>
        <div className="feed" style={{ paddingTop: '12px' }}>
          {renderCreateTabs()}
          {renderCreateContent()}
          <div className="write-view__footer" style={{ background: 'transparent', borderTop: 'none' }}>
            <button className="write-view__send" onClick={handleCreateSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGalleryView = () => {
    const photoPostMessages = feedMessages.filter((m) => m.type === 'photo');

    return (
      <div className="app-container">
        <header className="view-header">
          <button className="view-header__back" onClick={goHome}>
            {Icons.back}
          </button>
          <h1 className="view-header__title">Gallery</h1>
        </header>
        <div className="gallery-tabs">
          <button
            className={`gallery-tab ${galleryTab === 'photoOfDay' ? 'gallery-tab--active' : ''}`}
            onClick={() => setGalleryTab('photoOfDay')}
          >
            Photo of the Day
          </button>
          <button
            className={`gallery-tab ${galleryTab === 'posts' ? 'gallery-tab--active' : ''}`}
            onClick={() => setGalleryTab('posts')}
          >
            Posts
          </button>
        </div>
        {galleryTab === 'photoOfDay' ? (
          <div className="gallery-grid">
            {galleryPhotos.map((photo) => (
              <div
                key={photo.id}
                className="gallery-item"
                onClick={() => openPhotoOfDay(photo)}
              >
                <img src={photo.url} alt="" className="gallery-item__image" />
                <div className="gallery-item__date">{photo.date}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="gallery-grid">
            {photoPostMessages.map((msg) => {
              const images = msg.images && msg.images.length > 0 ? msg.images : msg.imageUrl ? [msg.imageUrl] : [];
              const fullImages = msg.fullImages && msg.fullImages.length > 0 ? msg.fullImages : images;
              if (images.length === 0) return null;
              return (
                <div
                  key={msg.id}
                  className="gallery-item"
                  onClick={() => openPostGallery(fullImages)}
                >
                  <img src={images[0]} alt="" className="gallery-item__image" />
                  {images.length > 1 && (
                    <div className="gallery-item__count">+{images.length - 1}</div>
                  )}
                  <div className="gallery-item__date">{msg.time}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderView = () => {
    switch (activeView) {
      case 'gallery':
        return renderGalleryView();

      case 'audio':
        return (
          <div className="app-container">
            <header className="view-header">
              <button className="view-header__back" onClick={goHome}>
                {Icons.back}
              </button>
              <h1 className="view-header__title">Audio</h1>
            </header>
            <div className="audio-section">
              <h2 className="audio-section__title">Voice Messages</h2>
              {audioItems
                .filter((a) => a.type === 'voice')
                .map((item) => (
                  <div key={item.id} className="audio-item">
                    <button
                      className="audio-item__play"
                      onClick={() => toggleAudio(item.id)}
                    >
                      {playingAudio === item.id ? Icons.pause : Icons.play}
                    </button>
                    <div className="audio-item__info">
                      <div className="audio-item__title">{item.title}</div>
                      <div className="audio-item__duration">{item.duration}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="audio-section">
              <h2 className="audio-section__title">Music</h2>
              {audioItems
                .filter((a) => a.type === 'music')
                .map((item) => (
                  <div key={item.id} className="audio-item">
                    <button
                      className="audio-item__play"
                      onClick={() => toggleAudio(item.id)}
                    >
                      {playingAudio === item.id ? Icons.pause : Icons.play}
                    </button>
                    <div className="audio-item__info">
                      <div className="audio-item__title">{item.title}</div>
                      <div className="audio-item__duration">{item.duration}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );

      case 'write':
        return renderConversationView();

      case 'personal':
        return renderConversationView();

      case 'create':
        return renderCreateView();

      case 'saved':
        return (
          <div className="app-container">
            <header className="view-header">
              <button className="view-header__back" onClick={goHome}>
                {Icons.back}
              </button>
              <h1 className="view-header__title">Saved</h1>
            </header>
            <div className="feed" style={{ paddingTop: '12px' }}>
              {savedMessages.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state__title">Nothing saved yet</div>
                  <div className="empty-state__subtitle">Tap &quot;Read later&quot; on a post to keep it here.</div>
                </div>
              )}
              {savedMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isAdmin={isAdmin}
                  isBookmarked={bookmarks[message.id] || false}
                  reaction={reactions[message.id]}
                  emojiPanelOpen={emojiPanelOpen === message.id}
                  onSay={() => openComments(message.id)}
                  onBookmark={() => toggleBookmark(message.id)}
                  onReact={() => toggleEmojiPanel(message.id)}
                  onSelectEmoji={(emoji) => selectReaction(message.id, emoji)}
                  onOpenGallery={(images) => openPostGallery(images)}
                  onShowToast={showToast}
                  onVoteOption={
                    message.type === 'poll' && message.pollId && (message.pollOptionStats?.length || message.pollOptions?.length)
                      ? (optionId) => voteOnPollOption(message.pollId as string, optionId)
                      : undefined
                  }
                  pollIsVoting={message.pollId ? Boolean(pollVoteLoadingById[message.pollId]) : false}
                />
              ))}
            </div>
          </div>
        );

      case 'treat':
        return (
          <div className="app-container">
            <header className="view-header">
              <button className="view-header__back" onClick={goHome}>
                {Icons.back}
              </button>
              <h1 className="view-header__title">Treat</h1>
            </header>
            <div className="treat-cards">
              <div className="treat-card">
                <div className="treat-card__icon">☕</div>
                <h3 className="treat-card__title">Coffee</h3>
                <p className="treat-card__desc">
                  A small, warm gesture of support. Like sharing a quiet morning together.
                </p>
                <button className="treat-card__btn" onClick={() => handleTreat('Coffee')}>
                  Continue
                </button>
              </div>
              <div className="treat-card">
                <div className="treat-card__icon">🍽️</div>
                <h3 className="treat-card__title">Dinner</h3>
                <p className="treat-card__desc">
                  A deeper way to say thank you. An invitation to share a moment.
                </p>
                <button className="treat-card__btn" onClick={() => handleTreat('Dinner')}>
                  Continue
                </button>
              </div>
              <div className="treat-card">
                <div className="treat-card__icon">🎁</div>
                <h3 className="treat-card__title">Gift</h3>
                <p className="treat-card__desc">
                  Something special and personal. A meaningful connection.
                </p>
                <button className="treat-card__btn" onClick={() => handleTreat('Gift')}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div
            className={`home-view swipe-container ${isPhotoOpen ? 'home-view--hidden' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleFreeAreaClick}
          >
            <div className="fullscreen-bg">
              {currentPhoto?.url ? (
                <img src={currentPhoto.url} alt="Photo of the day" className="fullscreen-bg__image" />
              ) : null}
              <div className="fullscreen-bg__overlay" />
            </div>

            {/* Top branding header */}
            <div className="top-branding">
              <div className="top-branding__logo-line">
                <span className="top-branding__prefix">{BRANDING.prefix}</span>
                <span className="top-branding__name">{BRANDING.name}</span>
              </div>
              <div className="top-branding__tagline">{BRANDING.tagline}</div>
            </div>

            <header className="photo-header">
              <div className="photo-header__nav">
                {Boolean(currentPhoto && currentPhotoIndex > 0) && (
                  <button
                    className="photo-header__nav-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPrevPhoto();
                    }}
                  >
                    ‹
                  </button>
                )}
                {Boolean(
                  currentPhoto &&
                    (currentPhotoIndex < galleryPhotos.length - 1 || (photoOfDayHasMoreOlder && !photoOfDayLoading)),
                ) && (
                  <button
                    className="photo-header__nav-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      void goToNextPhoto();
                    }}
                  >
                    ›
                  </button>
                )}
              </div>
              <div className="photo-header__info">
                <div className="photo-header__label-row">
                  <div className="photo-header__label">Photo of the day</div>
                  {currentPhoto?.description && (
                    <button
                      className="photo-header__about-chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoAboutOpen(true);
                      }}
                    >
                      about
                    </button>
                  )}
                </div>
                <div className="photo-header__date">
                  {currentPhoto ? `${currentPhoto.date} • ${currentPhoto.time}` : photoOfDayLoading ? 'Loading…' : 'No photo yet'}
                </div>
              </div>
            </header>

            <div className="swipe-dots">
              {galleryPhotos.slice(0, 10).map((_, index) => (
                <div
                  key={index}
                  className={`swipe-dot ${index === currentPhotoIndex ? 'swipe-dot--active' : ''}`}
                />
              ))}
              {galleryPhotos.length > 10 && <span className="swipe-dots__more">+{galleryPhotos.length - 10}</span>}
            </div>

            <div
              className={`refresh-indicator ${loadingPosts ? 'refresh-indicator--spinning' : ''}`}
              style={{
                opacity: loadingPosts || pullDistance > 0 ? 1 : 0,
                transform: `translateY(${Math.min(pullDistance, 48)}px)`,
              }}
            >
              <span className="refresh-indicator__icon">{Icons.refresh}</span>
              <span className="refresh-indicator__label">
                {loadingPosts ? 'Refreshing…' : pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
              </span>
            </div>

            {/* Feed without date dividers - date shown in each message's meta */}
            <div className="feed feed--overlay" ref={feedScrollContainerRef}>
              {feedShowLoadMore && feedHasMoreOlder && (
                <div
                  style={{ padding: '10px 0', textAlign: 'center' }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="inline-btn inline-btn--ghost"
                    onClick={() => void loadMoreFeedPosts('manual')}
                    disabled={feedLoadingMore}
                  >
                    {feedLoadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
              {feedItems.map((item) => {
                // Skip date dividers - date is now shown in message__meta
                if (item.type === 'date') return null;
                const message = item.message;
                const canEditThisPost = canEditPost(message);
                const canDeleteThisPost = canDeletePost(message);
                const isEditingThisPost = editingPostId === message.id;
                const postDraftValue = postDrafts[message.id] ?? message.text ?? '';
                const showPostActionsMenu = (canEditThisPost || canDeleteThisPost) && !isEditingThisPost;
                const postMenuOpen = postActionsOpenId === message.id;
                if (postMenuOpen && process.env.NODE_ENV !== 'production') {
                  console.log('[menu-debug] Rendering menu list for:', message.id);
                }
                const postActionMenu = showPostActionsMenu ? (
                  <div
                    className="post-actions-menu"
                    style={{
                      position: 'relative',
                      top: 'auto',
                      right: 'auto',
                      display: 'inline-flex',
                      verticalAlign: 'middle',
                      marginLeft: '6px',
                      zIndex: 10
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="post-actions-menu__trigger"
                      style={{
                        width: '20px',
                        height: '20px',
                        fontSize: '16px',
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        color: 'inherit',
                        padding: 0,
                        opacity: 0.7
                      }}
                      aria-haspopup="menu"
                      aria-expanded={postMenuOpen}
                      aria-label="Post actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePostActionsMenu(message.id);
                      }}
                    >
                      ⋮
                    </button>
                    {postMenuOpen && (
                      <div
                        className="post-actions-menu__list"
                        role="menu"
                        style={{
                          top: '24px',
                          right: '-8px',
                          width: '120px',
                          minWidth: 'unset'
                        }}
                      >
                        <button
                          type="button"
                          className="post-actions-menu__item"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditPost(message);
                          }}
                        >
                          Edit
                        </button>
                        {canDeleteThisPost && (
                          <button
                            type="button"
                            className="post-actions-menu__item post-actions-menu__item--danger"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePost(message);
                            }}
                            disabled={postDeletingId === message.id}
                          >
                            {postDeletingId === message.id ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : undefined;

                return (
                  <div key={message.id} className="feed-item">
                    <div className="post-card">
                      {isEditingThisPost && canEditThisPost && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginBottom: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '10px',
                          }}
                        >
                          <textarea
                            value={postDraftValue}
                            onChange={(e) =>
                              setPostDrafts((prev) => ({ ...prev, [message.id]: e.target.value }))
                            }
                            className="write-view__textarea"
                            style={{ minHeight: '120px', padding: '10px' }}
                          />
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="inline-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                savePostEdit(message);
                              }}
                              disabled={postSavingId === message.id}
                              style={{ padding: '6px 10px' }}
                            >
                              {postSavingId === message.id ? 'Saving…' : 'OK'}
                            </button>
                            <button
                              type="button"
                              className="inline-btn inline-btn--ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                cancelEditPost();
                              }}
                              style={{ padding: '6px 10px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <MessageBubble
                        message={message}
                        isAdmin={isAdmin}
                        isBookmarked={bookmarks[message.id] || false}
                        reaction={reactions[message.id]}
                        emojiPanelOpen={emojiPanelOpen === message.id}
                        onSay={() => openComments(message.id)}
                        onBookmark={() => toggleBookmark(message.id)}
                        onReact={() => toggleEmojiPanel(message.id)}
                        onSelectEmoji={(emoji) => selectReaction(message.id, emoji)}
                        onOpenGallery={(images) => openPostGallery(images)}
                        onShowToast={showToast}
                        onVoteOption={
                          message.type === 'poll' && message.pollId && (message.pollOptionStats?.length || message.pollOptions?.length)
                            ? (optionId) => voteOnPollOption(message.pollId as string, optionId)
                            : undefined
                        }
                        pollIsVoting={message.pollId ? Boolean(pollVoteLoadingById[message.pollId]) : false}
                        actionMenu={postActionMenu}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {showLatestButton && (
              <button
                type="button"
                className="latest-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToBottomImmediate();
                }}
                aria-label="Jump to latest post"
              >
                ↓ Latest
              </button>
            )}

            {hasUnreadAdminMessage && (
              <button className="notification-banner" onClick={openArtistMessage}>
                <span>New letter from Kareevsky</span>
                <span className="badge badge--pill">{unreadAdminCount}</span>
              </button>
            )}

            <button
              type="button"
              className={`refresh-btn ${loadingPosts ? 'refresh-btn--loading' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleManualRefresh();
              }}
              aria-label="Refresh feed"
              disabled={loadingPosts}
            >
              <span className="refresh-btn__icon">{Icons.refresh}</span>
            </button>

            <button
              type="button"
              className="menu-btn"
              onClick={openMenu}
              aria-label="Open menu"
            >
              {Icons.menu}
            </button>
          </div>
        );
    }
  };

  // Use access.session directly to avoid race condition with useEffect updating isSignedIn
  if (access.status !== 'allowed') {
    return (
      <div className="welcome-page">
        <div className="welcome-card">
          <div className="welcome-loading">
            {access.status === 'checking' ? 'Checking access…' : 'Redirecting to the welcome page…'}
          </div>
          {access.status === 'redirecting' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <a className="welcome-link" href="/welcome">
                Open welcome
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="welcome-page">
        <div className="welcome-card">
          <div className="welcome-loading">Please sign in to continue.</div>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <a className="welcome-link" href="/welcome">
              Open welcome
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthBar
        onAuthState={(nextSession, nextIsAdmin) => {
          setIsSignedIn(Boolean(nextSession));
          setIsAdmin(nextIsAdmin);
        }}
      />
      {renderView()}

      {showPushBanner && (
        <div
          className="push-banner"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            maxWidth: '520px',
            width: 'calc(100% - 24px)',
            background: 'rgba(0,0,0,0.9)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            padding: '12px 14px',
            textAlign: 'center',
            boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ color: 'white', fontSize: '14px', lineHeight: 1.4, fontFamily: 'var(--font-ui)' }}>
            Notifications are turned off. You can enable them in the menu.
          </div>
        </div>
      )}

      {menuOpen && (
        <>
          <div className="backdrop" onClick={closeMenu} />
          <div className="bottom-sheet">
            <button className="bottom-sheet__close-btn" onClick={closeMenu} aria-label="Close menu">
              ×
            </button>
            <div className="bottom-sheet__handle" />
            <div className="bottom-sheet__items">
              {!isStandalone && (
                <button
                  className="bottom-sheet__item"
                  onClick={handleInstallClick}
                  disabled={isStandalone}
                >
                  <span className="bottom-sheet__icon">{Icons.download}</span>
                  Install app
                </button>
              )}
              {isStandalone && (
                <button className="bottom-sheet__item bottom-sheet__item--disabled" disabled>
                  <span className="bottom-sheet__icon">{Icons.download}</span>
                  Installed
                </button>
              )}
              <button
                type="button"
                className={`bottom-sheet__item${pushState === 'denied' ? ' bottom-sheet__item--disabled' : ''}`}
                onClick={handleNotificationsClick}
                disabled={pushState === 'denied'}
                aria-disabled={pushState === 'denied'}
              >
                <span className="bottom-sheet__icon">{Icons.refresh}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                  Notifications
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.12)',
                      color: 'white',
                      fontSize: '12px',
                    }}
                  >
                    {pushState === 'on' ? 'On' : pushState === 'denied' ? 'Denied' : 'Off'}
                  </span>
                </span>
              </button>
              {pushState === 'denied' && (
                <div
                  style={{
                    marginTop: '-6px',
                    marginBottom: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: 'white',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                >
                  Notifications are blocked in your browser/phone settings. Enable permission for this site, then return here.
                </div>
              )}
              {isPushDebugEnabled && (
                <div
                  style={{
                    marginTop: '8px',
                    marginBottom: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '12px',
                    lineHeight: 1.35,
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <div style={{ marginBottom: '6px', opacity: 0.9 }}>Push debug (`debugPush=1`)</div>
                  {pushLastError && (
                    <div style={{ marginBottom: '6px', color: 'rgba(255,210,210,0.95)' }}>Last error: {pushLastError}</div>
                  )}
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '200px',
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify(pushDebug, null, 2)}
                  </pre>
                </div>
              )}
              <button className="bottom-sheet__item" onClick={() => navigateTo('gallery')}>
                <span className="bottom-sheet__icon">{Icons.gallery}</span>
                Gallery
              </button>
              <button className="bottom-sheet__item" onClick={() => navigateTo('audio')}>
                <span className="bottom-sheet__icon">{Icons.audio}</span>
                Audio
              </button>
              {isAdmin && (
                <button className="bottom-sheet__item" onClick={() => navigateTo('create')}>
                  <span className="bottom-sheet__icon">{Icons.write}</span>
                  New post
                </button>
              )}
              <button className="bottom-sheet__item" onClick={() => navigateTo('saved')}>
                <span className="bottom-sheet__icon">{Icons.bookmark}</span>
                Saved
              </button>
              <button className="bottom-sheet__item" onClick={openArtistMessage}>
                <span className="bottom-sheet__icon">{Icons.write}</span>
                <span className="relative inline-flex items-center gap-2">
                  Write to Kareevsky
                  {unreadAdminCount > 0 && (
                    <span className="badge badge--pill">{unreadAdminCount}</span>
                  )}
                </span>
              </button>
              <button className="bottom-sheet__item" onClick={() => navigateTo('treat')}>
                <span className="bottom-sheet__icon">{Icons.coffee}</span>
                Treat
              </button>
              <button
                className="bottom-sheet__item"
                onClick={() => {
                  setDocumentsOpen(true);
                  setMenuOpen(false);
                }}
              >
                <span className="bottom-sheet__icon">{Icons.documents}</span>
                Documents
              </button>
              {isSignedIn && (
                <button className="bottom-sheet__item" onClick={handleSignOut}>
                  <span className="bottom-sheet__icon">{Icons.close}</span>
                  Sign out
                </button>
              )}
              {isAdmin && (
                <button
                  className="bottom-sheet__item"
                  onClick={() => {
                    if (!isAdmin) return;
                    setMenuOpen(false);
                    setAddPhotoDayOpen(true);
                  }}
                >
                  <span className="bottom-sheet__icon">{Icons.gallery}</span>
                  Add Photo of the Day
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {documentsOpen && (
        <div className="modal-overlay" onClick={() => setDocumentsOpen(false)}>
          <div className="modal documents-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal__header">
              <h2 className="comments-modal__title">Documents</h2>
              <button onClick={() => setDocumentsOpen(false)} aria-label="Close">
                {Icons.close}
              </button>
            </div>
            <div className="documents-modal__content">
              <a className="documents-link" href="/terms" onClick={() => setDocumentsOpen(false)}>
                Terms
              </a>
              <a className="documents-link" href="/privacy" onClick={() => setDocumentsOpen(false)}>
                Privacy
              </a>
            </div>
          </div>
        </div>
      )}

      {addPhotoDayOpen && (
        <div className="modal-overlay" onClick={() => setAddPhotoDayOpen(false)}>
          <div className="modal create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal__header">
              <h2 className="comments-modal__title">Add Photo of the Day</h2>
              <button onClick={() => setAddPhotoDayOpen(false)}>{Icons.close}</button>
            </div>
            <div style={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="create-section">
                <label className="create-label">Select Photos (multiple)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      setNewPhotoDayFiles((prev) => [...prev, ...files]);
                      const nextPreviews = files.map((f) => URL.createObjectURL(f));
                      setNewPhotoDayPreviews((prev) => [...prev, ...nextPreviews]);
                      setNewPhotoDayDescs((prev) => [...prev, ...files.map(() => '')]);
                      setNewPhotoDayDates((prev) => [...prev, ...files.map(() => '')]);
                      setNewPhotoDayTimes((prev) => [...prev, ...files.map(() => '')]);
                    }
                  }}
                  className="create-input"
                />
                {newPhotoDayPreviews.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    {newPhotoDayPreviews.map((preview, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: '16px',
                          padding: '12px',
                          background: 'rgba(255,255,255,0.04)',
                          borderRadius: '12px',
                          position: 'relative',
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Remove photo"
                          onClick={() => removePhotoDayAtIndex(i)}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                          }}
                        >
                          ×
                        </button>
                        <img
                          src={preview}
                          alt=""
                          style={{
                            width: '100%',
                            maxHeight: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <input
                            value={newPhotoDayDates[i] || ''}
                            onChange={(e) => {
                              const next = [...newPhotoDayDates];
                              next[i] = e.target.value;
                              setNewPhotoDayDates(next);
                            }}
                            className="create-input"
                            placeholder="Date (e.g. Dec 12)"
                            style={{ flex: 1 }}
                          />
                          <input
                            value={newPhotoDayTimes[i] || ''}
                            onChange={(e) => {
                              const next = [...newPhotoDayTimes];
                              next[i] = e.target.value;
                              setNewPhotoDayTimes(next);
                            }}
                            className="create-input"
                            placeholder="Time (e.g. 14:30)"
                            style={{ flex: 1 }}
                          />
                        </div>
                        <input
                          value={newPhotoDayDescs[i] || ''}
                          onChange={(e) => {
                            const next = [...newPhotoDayDescs];
                            next[i] = e.target.value;
                            setNewPhotoDayDescs(next);
                          }}
                          className="create-input"
                          placeholder={`About photo ${i + 1}...`}
                          style={{ marginTop: '8px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="write-view__send"
                  style={{ marginTop: '16px' }}
                  onClick={() => void handleAddPhotoDaySave()}
                  disabled={newPhotoDayFiles.length === 0 || photoOfDayPublishing}
                >
                  Publish {newPhotoDayFiles.length > 0 ? `(${newPhotoDayFiles.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {photoViewer && (
        <div
          className={`photo-viewer ${isFullscreen ? 'photo-viewer--fullscreen' : ''}`}
          ref={photoViewerContainerRef}
          onClick={closePhotoViewer}
        >
          <div
            className="photo-viewer__content"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handlePhotoViewerTouchStart}
            onTouchEnd={handlePhotoViewerTouchEnd}
          >
            <img
              src={photoViewer.images[photoViewer.index]}
              alt=""
              className="photo-viewer__image"
              onLoad={(e) => {
                const img = e.currentTarget;
                setCurrentImageAspect(img.naturalWidth / Math.max(1, img.naturalHeight));
              }}
            />

            <button className="photo-viewer__close" onClick={closePhotoViewer} aria-label="Close">
              {Icons.close}
            </button>

            {canFullscreen && (
              <button
                type="button"
                className="photo-viewer__fs-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? Icons.compress : Icons.fullscreen}
              </button>
            )}

            {photoViewer.images.length > 1 && (
              <div className="photo-viewer__nav">
                <button
                  className="photo-viewer__nav-btn"
                  onClick={() => stepPhotoViewer(-1)}
                  disabled={photoViewer.index === 0}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <div className="photo-viewer__counter">
                  {photoViewer.index + 1}|{photoViewer.images.length}
                </div>
                <button
                  className="photo-viewer__nav-btn"
                  onClick={() => stepPhotoViewer(1)}
                  disabled={photoViewer.index === photoViewer.images.length - 1}
                  aria-label="Next photo"
                >
                  ›
                </button>
              </div>
            )}

            {(photoViewer.description || photoViewer.date || photoViewer.time) && (
              <div className="photo-viewer__meta">
                {photoViewer.description && (
                  <p className="photo-viewer__desc">{photoViewer.description}</p>
                )}
                {(photoViewer.date || photoViewer.time) && (
                  <div className="photo-viewer__date">
                    {[photoViewer.date, photoViewer.time].filter(Boolean).join(' • ')}
                  </div>
                )}
              </div>
            )}

            {showRotateHint && (
              <div className="rotate-hint">
                <span>Rotate your phone to view in full</span>
                <button
                  type="button"
                  className="rotate-hint__close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRotateHint(false);
                    setRotateHintDismissed(true);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('rotate-hint-dismissed', '1');
                    }
                  }}
                  aria-label="Dismiss hint"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {photoAboutOpen && currentPhoto?.description && (
        <div className="modal-overlay" onClick={() => setPhotoAboutOpen(false)}>
          <div className="modal about-modal" onClick={(e) => e.stopPropagation()}>
            <div className="about-modal__header">
              <div className="about-modal__title">About this photo</div>
              <button className="about-modal__close" onClick={() => setPhotoAboutOpen(false)}>
                {Icons.close}
              </button>
            </div>
            <p className="about-modal__text">{currentPhoto?.description}</p>
          </div>
        </div>
      )}

      {commentsModalOpen && (
        <div className="modal-overlay" onClick={closeComments}>
          <div className="modal comments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal__header">
              <h2 className="comments-modal__title">Comments</h2>
              <button onClick={closeComments}>{Icons.close}</button>
            </div>
            <div className="comments-modal__list">
              {commentsForActiveMessage.map((comment) => {
                const commentCanEdit = canEditComment(comment);
                const commentCanDelete = canDeleteComment(comment);
                const showCommentMenu = (commentCanEdit || commentCanDelete) && editingCommentId !== comment.id;
                const commentMenuOpen = commentActionsOpenId === comment.id;
                return (
                  <div key={comment.id} className="comment" style={{ position: 'relative' }}>
                    {showCommentMenu && (
                      <div
                        className="post-actions-menu post-actions-menu--comment"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="post-actions-menu__trigger"
                          aria-haspopup="menu"
                          aria-expanded={commentMenuOpen}
                          aria-label="Comment actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCommentActionsMenu(comment.id);
                          }}
                        >
                          ⋮
                        </button>
                        {commentMenuOpen && (
                          <div className="post-actions-menu__list" role="menu">
                            {commentCanEdit && (
                              <button
                                type="button"
                                className="post-actions-menu__item"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditComment(comment);
                                }}
                              >
                                Edit
                              </button>
                            )}
                            {commentCanDelete && (
                              <button
                                type="button"
                                className="post-actions-menu__item post-actions-menu__item--danger"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteComment(comment);
                                }}
                                disabled={commentDeletingId === comment.id}
                              >
                                {commentDeletingId === comment.id ? 'Deleting…' : 'Delete'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      className="comment__author"
                      style={{
                        color: comment.author === 'Kareevsky' ? 'var(--accent)' : undefined,
                      }}
                    >
                      {comment.author}
                      {/* (edited) label removed */}
                    </div>
                    {editingCommentId === comment.id ? (
                      <>
                        <textarea
                          value={commentDrafts[comment.id] ?? comment.text}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [comment.id]: e.target.value }))
                          }
                          className="write-view__textarea"
                          style={{ minHeight: '80px', padding: '12px', marginTop: '6px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            className="inline-btn"
                            onClick={() => saveCommentEdit(comment)}
                            disabled={commentSavingId === comment.id}
                          >
                            {commentSavingId === comment.id ? 'Saving…' : 'OK'}
                          </button>
                          <button className="inline-btn inline-btn--ghost" onClick={cancelEditComment}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="comment__text">{comment.text}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '12px' }}>
              {isAdmin && (
                <>
                  <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Reply as Kareevsky
                  </div>
                  <textarea
                    value={commentReply}
                    onChange={(e) => setCommentReply(e.target.value)}
                    className="write-view__textarea"
                    style={{ minHeight: '80px', padding: '12px' }}
                    placeholder="Write a short reply..."
                  />
                  <div style={{ marginTop: '8px', textAlign: 'right' }}>
                    <button
                      className="write-view__send"
                      style={{ width: 'auto', padding: '8px 14px' }}
                      onClick={handleSendComment}
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showInstallBanner && !isStandalone && (
        <div className="install-banner">
          <div className="install-banner__text">
            {isIosBrowser
              ? 'Add to Home Screen for easy access with one tap.'
              : 'Install the app to open it as a PWA.'}
          </div>
          <div className="install-banner__actions">
            <button className="install-banner__btn" onClick={handleInstallClick}>
              Install
            </button>
            <button
              className="install-banner__close"
              type="button"
              aria-label="Dismiss install banner"
              onClick={dismissInstallBanner}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showInstallInstructions && (
        <div className="modal-overlay" onClick={closeInstallInstructions}>
          <div className="modal install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal__header">
              <h2 className="install-modal__title">How to install</h2>
              <button
                className="install-modal__close"
                onClick={closeInstallInstructions}
                aria-label="Close install instructions"
              >
                ×
              </button>
            </div>
            <div className="install-modal__body">
              {isIosBrowser ? (
                <ol className="install-modal__steps">
                  <li>1. Tap the Share button (arrow icon in Safari).</li>
                  <li>2. Select &quot;Add to Home Screen&quot;.</li>
                  <li>3. Confirm the installation.</li>
                </ol>
              ) : (
                <ol className="install-modal__steps">
                  <li>1. Open the browser menu (... or Share icon).</li>
                  <li>2. Select &quot;Install app&quot; or &quot;Add to Home Screen&quot;.</li>
                  <li>3. Confirm the installation.</li>
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {toastMessage && <div className="toast">{toastMessage}</div>}
    </>
  );
}

interface MessageBubbleProps {
  message: Message;
  isBookmarked: boolean;
  isAdmin: boolean;
  reaction?: string;
  emojiPanelOpen: boolean;
  onSay: () => void;
  onBookmark: () => void;
  onReact: () => void;
  onSelectEmoji: (emoji: string) => void;
  onOpenGallery: (images: string[]) => void;
  onShowToast: (text: string, timeoutMs?: number) => void;
  onVoteOption?: (optionId: string) => void;
  pollIsVoting?: boolean;
  actionMenu?: React.ReactNode;
}

function LazyImg({
  src,
  alt,
  className,
  style,
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const { ref, visible } = useElementVisibleOnce<HTMLImageElement>({ rootMargin: '800px 0px' });
  return (
    <img
      ref={ref}
      src={visible ? src : TRANSPARENT_PIXEL}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    />
  );
}

function MessageBubble({
  message,
  isBookmarked,
  isAdmin,
  reaction,
  emojiPanelOpen,
  onSay,
  onBookmark,
  onReact,
  onSelectEmoji,
  onOpenGallery,
  onShowToast,
  onVoteOption,
  pollIsVoting,
  actionMenu,
}: MessageBubbleProps) {
  const [i18nSelectedLang, setI18nSelectedLang] = useState<I18nLang>('en');
  const [i18nImageIndex, setI18nImageIndex] = useState(0);
  const [videoRequested, setVideoRequested] = useState(false);

  // Deterrence only: not DRM and cannot block screen recording
  const isReader = !isAdmin;
  const deterrentClass = isReader ? 'deterrent-content' : '';
  const handleContentContextMenu = isReader ? (event: React.MouseEvent) => event.preventDefault() : undefined;

  useEffect(() => {
    setI18nSelectedLang('en');
    setI18nImageIndex(0);
    setVideoRequested(false);
  }, [message.id]);

  useEffect(() => {
    setI18nImageIndex(0);
  }, [i18nSelectedLang]);

  const langLabels: Record<I18nLang, { flag: string; code: string }> = {
    en: { flag: '🇬🇧', code: 'EN' },
    es: { flag: '🇪🇸', code: 'ES' },
    fr: { flag: '🇫🇷', code: 'FR' },
    it: { flag: '🇮🇹', code: 'IT' },
  };

  const renderI18nFlags = (available: I18nLang[], onSelect: (lang: I18nLang) => void) => (
    <div className="i18n-flags">
      {available.map((lang) => (
        <button
          key={lang}
          type="button"
          className={`i18n-flag ${i18nSelectedLang === lang ? 'i18n-flag--active' : ''}`}
          onClick={() => onSelect(lang)}
          aria-label={`Switch to ${langLabels[lang].code}`}
        >
          {langLabels[lang].flag}
        </button>
      ))}
    </div>
  );

  // Render i18n (multi-language) posts
  if (message.type === 'i18n' && message.i18nPack) {
    const { mode, items } = message.i18nPack;
    const availableLangs = items.map((it) => it.lang);
    const currentItem =
      items.find((it) => it.lang === i18nSelectedLang) || items.find((it) => it.lang === 'en') || items[0];
    const missingLanguage = !currentItem || currentItem.lang !== i18nSelectedLang;

    if (mode === 'text') {
      const content = currentItem?.text;
      return (
        <div className="message message--i18n">
          <div className="i18n-header">{renderI18nFlags(availableLangs, setI18nSelectedLang)}</div>
          <div
            className={`message__bubble message__bubble--text ${deterrentClass}`}
            onContextMenu={handleContentContextMenu}
          >
            {missingLanguage && (
              <div className="i18n-missing">This language is not available yet. Please read another one.</div>
            )}
            <p className="message__handwriting">{renderLinkifiedText(content || '')}</p>
            <div className="message__meta">
              {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
            {actionMenu}
            </div>
          </div>

          {reaction && <div className="message__reaction">{reaction}</div>}

          <div className="actions">
            <button className="actions__btn" onClick={onSay}>
              {Icons.message}
              <span>Say</span>
            </button>
            <button
              className={`actions__btn ${isBookmarked ? 'actions__btn--active' : ''}`}
              onClick={onBookmark}
            >
              {isBookmarked ? Icons.bookmarkFilled : Icons.bookmark}
              <span>{isBookmarked ? 'Saved' : 'Read later'}</span>
            </button>
            <button className="actions__btn" onClick={onReact}>
              {Icons.sparkle}
              <span>React</span>
            </button>
          </div>

          {emojiPanelOpen && (
            <div className="emoji-panel">
              {emojis.map((emoji) => (
                <button key={emoji} className="emoji-panel__btn" onClick={() => onSelectEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    const images =
      (currentItem?.imageUrls && currentItem.imageUrls.length > 0
        ? currentItem.imageUrls
        : currentItem?.imageUrl
          ? [currentItem.imageUrl]
          : []) || [];
    const orderedImages = images;
    const currentImage = orderedImages[i18nImageIndex] || orderedImages[0] || '';

    return (
      <div className="message message--i18n">
        <div className="i18n-header">{renderI18nFlags(availableLangs, setI18nSelectedLang)}</div>
        <div className="i18n-carousel">
          <div
            className={`i18n-carousel__image-container ${deterrentClass}`}
            onContextMenu={handleContentContextMenu}
          >
            {isReader && (
              <div
                className="deterrent-media-guard"
                aria-hidden="true"
                onClick={() => onOpenGallery(orderedImages)}
              />
            )}
            {currentImage && (
              <LazyImg
                src={currentImage}
                alt={`${langLabels[currentItem?.lang || 'en'].code} version`}
                className="i18n-carousel__image"
                onClick={() => onOpenGallery(orderedImages)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenGallery(orderedImages);
                  }
                }}
              />
            )}
            {missingLanguage && (
              <div className="i18n-missing i18n-missing--overlay">
                This language is not available yet. Please read another one.
              </div>
            )}
          </div>
          <div className="i18n-carousel__footer">
            <div className="i18n-carousel__lang-chip">
              <span className="i18n-carousel__flag">{langLabels[currentItem?.lang || 'en'].flag}</span>
              <span className="i18n-carousel__code">{langLabels[currentItem?.lang || 'en'].code}</span>
            </div>
            {orderedImages.length > 1 && (
              <div className="i18n-carousel__controls">
                <div className="i18n-carousel__nav">
                  <button
                    type="button"
                    className="i18n-carousel__nav-btn"
                    onClick={() => setI18nImageIndex((idx) => Math.max(0, idx - 1))}
                    disabled={i18nImageIndex === 0}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="i18n-carousel__nav-btn"
                    onClick={() => setI18nImageIndex((idx) => Math.min(orderedImages.length - 1, idx + 1))}
                    disabled={i18nImageIndex === orderedImages.length - 1}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </div>
                <div className="i18n-carousel__counter">{`${i18nImageIndex + 1}|${orderedImages.length}`}</div>
              </div>
            )}
          </div>
          <div className="i18n-carousel__meta">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
            {actionMenu}
          </div>
        </div>

        {reaction && <div className="message__reaction">{reaction}</div>}

        <div className="actions">
          <button className="actions__btn" onClick={onSay}>
            {Icons.message}
            <span>Say</span>
          </button>
          <button
            className={`actions__btn ${isBookmarked ? 'actions__btn--active' : ''}`}
            onClick={onBookmark}
          >
            {isBookmarked ? Icons.bookmarkFilled : Icons.bookmark}
            <span>{isBookmarked ? 'Saved' : 'Read later'}</span>
          </button>
          <button className="actions__btn" onClick={onReact}>
            {Icons.sparkle}
            <span>React</span>
          </button>
        </div>

        {emojiPanelOpen && (
          <div className="emoji-panel">
            {emojis.map((emoji) => (
              <button key={emoji} className="emoji-panel__btn" onClick={() => onSelectEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (message.type === 'poll') {
    const question = message.pollQuestion || '';
    const optionStats =
      message.pollOptionStats && message.pollOptionStats.length > 0
        ? message.pollOptionStats
        : (message.pollOptions || []).slice(0, 4).map((text, idx) => ({
            id: `${message.id}-opt-${idx}`,
            text,
            votes: 0,
          }));
    const totalVotes =
      typeof message.pollTotalVotes === 'number'
        ? message.pollTotalVotes
        : optionStats.reduce((sum, opt) => sum + (opt.votes || 0), 0);
    const hasVoted = Boolean(message.pollUserVoteOptionId);
    return (
      <div className="message">
        <div
          className={`message__bubble message__bubble--poll ${deterrentClass}`}
          onContextMenu={handleContentContextMenu}
        >
          <div className="poll__question">{question}</div>
          <div className="poll__options">
            {optionStats.map((opt) => {
              const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
              const disabled = !onVoteOption || hasVoted || pollIsVoting;
              const isSelected = hasVoted && message.pollUserVoteOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  className={`poll__option ${isSelected ? 'poll__option--selected' : ''}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!onVoteOption) return;
                    if (hasVoted) {
                      onShowToast('You already voted.');
                      return;
                    }
                    onVoteOption(opt.id);
                  }}
                >
                  <span className="poll__option-content">
                    <span>{opt.text}</span>
                    <span className="poll__option-count">
                      {totalVotes > 0 ? `${opt.votes} • ${percent}%` : '0'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="poll__meta">
            {hasVoted ? 'Thanks for voting • ' : ''}
            {totalVotes} vote{totalVotes === 1 ? '' : 's'}
            {pollIsVoting ? ' • Sending…' : ''}
          </div>
          {/* Date shown at bottom-right next to time */}
          <div className="message__meta">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
            {actionMenu}
          </div>
        </div>
      {reaction && <div className="message__reaction">{reaction}</div>}
      <div className="actions">
        <button className="actions__btn" onClick={onSay}>
          {Icons.message}
          <span>Say</span>
        </button>
        <button
          className={`actions__btn ${isBookmarked ? 'actions__btn--active' : ''}`}
          onClick={onBookmark}
        >
          {isBookmarked ? Icons.bookmarkFilled : Icons.bookmark}
          <span>{isBookmarked ? 'Saved' : 'Read later'}</span>
        </button>
        <button className="actions__btn" onClick={onReact}>
          {Icons.sparkle}
          <span>React</span>
        </button>
      </div>
      </div>
    );
  }

  if (message.type === 'photo') {
    // Use message.caption if exists, else fallback to photoCaptions for backwards compat
    const caption = message.caption || photoCaptions[message.id];
    const photoSet = message.images && message.images.length > 0 ? message.images : message.imageUrl ? [message.imageUrl] : [];
    const fullSet = message.fullImages && message.fullImages.length > 0 ? message.fullImages : photoSet;
    const showGrid = photoSet.length > 1;
    // For grids: show 2x2 for 4+, 2+1 for 3, 2 for 2
    const displayPhotos = photoSet.slice(0, 4);
    const extraCount = photoSet.length > 4 ? photoSet.length - 4 : 0;

    return (
      <div className="message">
        <div
          className={`message__bubble message__bubble--photo ${showGrid ? 'message__bubble--grid' : ''} ${deterrentClass}`}
          role="button"
          tabIndex={0}
          onClick={() => onOpenGallery(fullSet)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenGallery(fullSet);
            }
          }}
          onContextMenu={handleContentContextMenu}
        >
          {isReader && (
            <div
              className="deterrent-media-guard"
              aria-hidden="true"
              onClick={() => onOpenGallery(fullSet)}
            />
          )}
          {showGrid ? (
            <div className={`message__photo-grid message__photo-grid--${Math.min(displayPhotos.length, 4)}`}>
              {displayPhotos.map((src, idx) => (
                <div key={idx} className="message__photo-grid-item">
                  <LazyImg src={src} alt="" className="message__grid-image" />
                  {idx === displayPhotos.length - 1 && extraCount > 0 && (
                    <div className="message__photo-grid-more">+{extraCount}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <LazyImg src={photoSet[0]} alt="" className="message__image" />
          )}
          {/* Date shown at bottom-right next to time */}
          <div className="message__meta message__meta--photo">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
            {actionMenu}
          </div>
        </div>

        {caption && (
          <div
            className={`message__caption-bubble ${deterrentClass}`}
            onContextMenu={handleContentContextMenu}
          >
            <p className="message__caption">{renderLinkifiedText(caption)}</p>
          </div>
        )}

        {reaction && <div className="message__reaction">{reaction}</div>}

        <div className="actions">
          <button className="actions__btn" onClick={onSay}>
            {Icons.message}
            <span>Say</span>
          </button>
          <button
            className={`actions__btn ${isBookmarked ? 'actions__btn--active' : ''}`}
            onClick={onBookmark}
          >
            {isBookmarked ? Icons.bookmarkFilled : Icons.bookmark}
            <span>{isBookmarked ? 'Saved' : 'Read later'}</span>
          </button>
          <button className="actions__btn" onClick={onReact}>
            {Icons.sparkle}
            <span>React</span>
          </button>
        </div>

        {emojiPanelOpen && (
          <div className="emoji-panel">
            {emojis.map((emoji) => (
              <button key={emoji} className="emoji-panel__btn" onClick={() => onSelectEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (message.type === 'audio') {
    return (
      <div className="message">
        <div
          className={`message__bubble message__bubble--audio ${deterrentClass}`}
          onContextMenu={handleContentContextMenu}
        >
          <AudioPostPlayer
            audioUrl={message.audioUrl}
            storagePath={message.audioStoragePath}
            isReader={isReader}
          />
          <div className="message__meta">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
            {actionMenu}
          </div>
        </div>

        {message.text && (
          <div
            className={`message__caption-bubble ${deterrentClass}`}
            style={{ marginTop: '8px' }}
            onContextMenu={handleContentContextMenu}
          >
            <p className="message__handwriting">{renderLinkifiedText(message.text)}</p>
          </div>
        )}

        {reaction && <div className="message__reaction">{reaction}</div>}

        <div className="actions">
          <button className="actions__btn" onClick={onSay}>
            {Icons.message}
            <span>Say</span>
          </button>
          <button
            className={`actions__btn ${isBookmarked ? 'actions__btn--active' : ''}`}
            onClick={onBookmark}
          >
            {isBookmarked ? Icons.bookmarkFilled : Icons.bookmark}
            <span>{isBookmarked ? 'Saved' : 'Read later'}</span>
          </button>
          <button className="actions__btn" onClick={onReact}>
            {Icons.sparkle}
            <span>React</span>
          </button>
        </div>

        {emojiPanelOpen && (
          <div className="emoji-panel">
            {emojis.map((emoji) => (
              <button key={emoji} className="emoji-panel__btn" onClick={() => onSelectEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (message.type === 'video') {
    const posterUrl = message.videoPosterUrl;
    return (
      <div className="message">
        <div
          className={`message__bubble message__bubble--photo ${deterrentClass}`}
          style={{ width: 'auto', maxWidth: '100%' }}
          onContextMenu={handleContentContextMenu}
        >
          {!videoRequested ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '280px',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
              onClick={() => setVideoRequested(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setVideoRequested(true);
                }
              }}
            >
              {posterUrl ? (
                <LazyImg
                  src={posterUrl}
                  alt=""
                  style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'rgba(255,255,255,0.06)' }} />
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.0), rgba(0,0,0,0.25))',
                }}
                aria-hidden="true"
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.25)',
                  }}
                >
                  {Icons.play}
                </div>
              </div>
            </div>
          ) : (
            <video
              src={message.videoUrl}
              controls
              controlsList={isReader ? 'nodownload' : undefined}
              playsInline
              preload="none"
              autoPlay
              style={{ width: '100%', maxWidth: '280px', borderRadius: '16px', objectFit: 'contain' }}
            />
          )}
          <div className="message__meta message__meta--photo">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
            {actionMenu}
          </div>
        </div>

        {reaction && <div className="message__reaction">{reaction}</div>}

        <div className="actions">
          <button className="actions__btn" onClick={onSay}>
            {Icons.message}
            <span>Say</span>
          </button>
          <button
            className={`actions__btn ${isBookmarked ? 'actions__btn--active' : ''}`}
            onClick={onBookmark}
          >
            {isBookmarked ? Icons.bookmarkFilled : Icons.bookmark}
            <span>{isBookmarked ? 'Saved' : 'Read later'}</span>
          </button>
          <button className="actions__btn" onClick={onReact}>
            {Icons.sparkle}
            <span>React</span>
          </button>
        </div>

        {emojiPanelOpen && (
          <div className="emoji-panel">
            {emojis.map((emoji) => (
              <button key={emoji} className="emoji-panel__btn" onClick={() => onSelectEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="message">
      <div
        className={`message__bubble message__bubble--text ${deterrentClass}`}
        onContextMenu={handleContentContextMenu}
      >
        <p className="message__handwriting">{renderLinkifiedText(message.text)}</p>
        {/* Date shown at bottom-right next to time */}
        <div className="message__meta">
          {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
            {actionMenu}
        </div>
      </div>

      {reaction && <div className="message__reaction">{reaction}</div>}

      <div className="actions">
        <button className="actions__btn" onClick={onSay}>
          {Icons.message}
          <span>Say</span>
        </button>
        <button
          className={`actions__btn ${isBookmarked ? 'actions__btn--active' : ''}`}
          onClick={onBookmark}
        >
          {isBookmarked ? Icons.bookmarkFilled : Icons.bookmark}
          <span>{isBookmarked ? 'Saved' : 'Read later'}</span>
        </button>
        <button className="actions__btn" onClick={onReact}>
          {Icons.sparkle}
          <span>React</span>
        </button>
      </div>

      {emojiPanelOpen && (
        <div className="emoji-panel">
          {emojis.map((emoji) => (
            <button key={emoji} className="emoji-panel__btn" onClick={() => onSelectEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
