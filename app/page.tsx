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

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || null;

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
  const urlMap = await resolvePathsToSignedUrls(uniquePaths, { bucket: MEDIA_BUCKET });

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

const mapPostRowToMessage = (row: PostRow, adminUserId?: string | null): Message => {
  const meta = (row.metadata as Record<string, unknown> | null) || {};
  const typedMedia = ((row.post_media as PostMediaWithUrl[] | null | undefined) || []).filter(Boolean);
  const mediaImages = typedMedia.filter((m) => m.media_type === 'image').map((m) => m.url || m.storage_path);
  const images =
    mediaImages.length > 0
      ? mediaImages
      : (meta.image_urls as string[] | undefined) ||
        (meta.images as string[] | undefined) ||
        [];
  const messageType = coerceMessageType(row.type);
  const i18nPack = meta.i18n_pack as I18nPack | undefined;
  const pollQuestion = meta.poll_question as string | undefined;
  const pollOptions = meta.poll_options as string[] | undefined;
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
    text: bodyText,
    caption,
    subtitle,
    pollQuestion,
    pollOptions,
    i18nPack,
  };

  if (messageType === 'photo') {
    message.imageUrl = images?.[0];
    message.images = images;
  }
  if (messageType === 'video') {
    message.videoUrl = videoUrl;
  }
  if (messageType === 'audio') {
    message.audioUrl = audioUrl;
    message.audioStoragePath = audioStoragePath || undefined;
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

const guessAudioMimeType = (value?: string | null) => {
  if (!value) return undefined;
  const clean = (value.split('?')[0] || '').toLowerCase();
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
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
    const preferred = audioUrl || storagePath;

    const setErrorState = (message: string) => {
      if (cancelled) return;
      setResolvedSrc(null);
      setStatus('error');
      setErrorMessage(message);
    };

    setResolvedSrc(null);
    setStatus('loading');
    setErrorMessage(null);

    if (!preferred) {
      setErrorState('Audio file is not available');
      return;
    }

    if (isHttpUrl(preferred)) {
      if (cancelled) return;
      setResolvedSrc(preferred);
      setStatus('ready');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorState('Audio failed to load');
      return;
    }

    const normalizedPath = normalizeStoragePath(storagePath || audioUrl);
    if (!normalizedPath) {
      setErrorState('Audio file is not available');
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);
        let nextUrl = data?.signedUrl || null;

        if (error && process.env.NODE_ENV !== 'production') {
          console.warn('[audio] createSignedUrl fallback to public URL', {
            path: normalizedPath,
            message: error.message,
          });
        }

        if (!nextUrl) {
          const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(normalizedPath);
          nextUrl = publicData?.publicUrl || null;
        }

        if (!nextUrl) {
          throw new Error('No signed or public URL returned');
        }

        if (!cancelled) {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[audio] Resolved playback URL', { path: normalizedPath });
          }
          setResolvedSrc(nextUrl);
          setStatus('ready');
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[audio] Failed to resolve audio URL', err);
        }
        setErrorState('Audio failed to load');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, storagePath]);

  const mimeType = useMemo(
    () => guessAudioMimeType(resolvedSrc || audioUrl || storagePath),
    [resolvedSrc, audioUrl, storagePath],
  );

  if (status === 'error') {
    return (
      <div className="message__caption" style={{ padding: '8px 0' }}>
        {errorMessage || 'Audio failed to load'}
      </div>
    );
  }

  if (!resolvedSrc || status === 'loading') {
    return (
      <div className="message__caption" style={{ padding: '8px 0' }}>
        Loading audio…
      </div>
    );
  }

  return (
    <audio
      key={resolvedSrc}
      controls
      controlsList={isReader ? 'nodownload' : undefined}
      preload="metadata"
      playsInline
      style={{ width: '100%', maxWidth: '320px' }}
      onLoadedData={() => setStatus('ready')}
      onCanPlay={() => setStatus('ready')}
      onError={() => {
        setStatus('error');
        setErrorMessage('Audio failed to load');
      }}
    >
      <source src={resolvedSrc} type={mimeType} />
      Your browser does not support the audio element.
    </audio>
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
      <polyline points="3 4 3 10 9 10" />
      <polyline points="21 20 21 14 15 14" />
      <path d="M21 8a9 9 0 0 0-17.29-3" />
      <path d="M3 16a9 9 0 0 0 17.29 3" />
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

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() => photos.length - 1);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState>(null);

  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionsMap>({});
  const [bookmarks, setBookmarks] = useState<BookmarksMap>({});
  const [adminInbox, setAdminInbox] = useState<AdminInboxState>({ hasUnread: false, count: 0 });

  const [writeText, setWriteText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [personalMessages, setPersonalMessages] = useState<PersonalMessage[]>([]);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, Comment[]>>({});
  const [commentReply, setCommentReply] = useState('');
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
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>(() => [...photos].reverse());
  const [addPhotoDayOpen, setAddPhotoDayOpen] = useState(false);
  const [newPhotoDayFiles, setNewPhotoDayFiles] = useState<File[]>([]);
  const [newPhotoDayPreviews, setNewPhotoDayPreviews] = useState<string[]>([]);
  const [newPhotoDayDescs, setNewPhotoDayDescs] = useState<string[]>([]);
  const [newPhotoDayDates, setNewPhotoDayDates] = useState<string[]>([]);
  const [newPhotoDayTimes, setNewPhotoDayTimes] = useState<string[]>([]);
  const [feedMessages, setFeedMessages] = useState<Message[]>([]);
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
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const pendingScrollToBottom = useRef(false);
  const forceScrollToBottom = useRef(false);
  const bodyOverflowRef = useRef<string | null>(null);
  const didInitialScroll = useRef(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const postsRequestIdRef = useRef(0);
  const loadingPostsRef = useRef(false);
  const isMountedRef = useRef(true);
  const actionLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const feedScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollDistanceRafRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
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
  const [showLatestButton, setShowLatestButton] = useState(false);
  const NEAR_BOTTOM_DISTANCE_PX = 120;
  const LATEST_BUTTON_DISTANCE_PX = 600;

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
      if (canScrollFeed) return feedEl;
    }

    return docTarget;
  }, [getDocumentScrollElement]);

  const getScrollTarget = useCallback(() => scrollElementRef.current || resolveScrollContainer(), [resolveScrollContainer]);

  const scheduleDistanceCheck = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (scrollDistanceRafRef.current !== null) {
      cancelAnimationFrame(scrollDistanceRafRef.current);
    }

    scrollDistanceRafRef.current = window.requestAnimationFrame(() => {
      scrollDistanceRafRef.current = null;

      const target = getScrollTarget();
      if (!target) return;

      const distance = target.scrollHeight - (target.scrollTop + target.clientHeight);
      const nearBottom = distance < NEAR_BOTTOM_DISTANCE_PX;

      isNearBottomRef.current = nearBottom;
      setAutoScrollEnabled(nearBottom);
      setShowLatestButton(distance > LATEST_BUTTON_DISTANCE_PX);
    });
  }, [getScrollTarget, LATEST_BUTTON_DISTANCE_PX, NEAR_BOTTOM_DISTANCE_PX]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const target = getScrollTarget();
      if (!target) return;

      target.scrollTo({ top: target.scrollHeight, behavior });
      isNearBottomRef.current = true;
      setAutoScrollEnabled(true);
      setShowLatestButton(false);
    },
    [getScrollTarget],
  );

  const scrollToBottomImmediate = useCallback(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  const scrollToBottomSmooth = useCallback(() => {
    scrollToBottom('smooth');
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[feed] jump to latest');
    }
  }, [scrollToBottom]);

  const session = access.session;
  const user = session?.user;

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const pullDistanceRef = useRef(0);
  const lastTapTime = useRef<number>(0);

  const currentPhoto = galleryPhotos[currentPhotoIndex];
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

  const showToast = useCallback((text: string, timeoutMs = 2500) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), timeoutMs);
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration is best-effort; offline caching can be added later.
    });
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
          .order('created_at', { ascending: true });

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
          const rowsWithUrls = await resolveMediaForRows(rows);
          const mapped = rowsWithUrls.map((row) => mapPostRowToMessage(row, adminUserIdRef.current));
          const commentMap: Record<string, Comment[]> = {};
          rowsWithUrls.forEach((row) => {
            const mappedComments = (row.comments || [])
              .filter((c) => !c.is_deleted)
              .map((c) => mapCommentRow(c, adminUserIdRef.current));
            if (mappedComments.length) {
              commentMap[row.id] = mappedComments;
            }
          });
          setFeedMessages(mapped);
          setCommentsByPostId(commentMap);
          setPostsSource('supabase');
          console.info(`[data] Loaded ${mapped.length} posts from Supabase`);
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
    [showToast],
  );

  useEffect(() => {
    refreshFeed('initial');
  }, [refreshFeed]);

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
      const handleScroll = () => scheduleDistanceCheck();
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
      }

      scheduleDistanceCheck();
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
    };
  }, [resolveScrollContainer, scheduleDistanceCheck, feedItems.length, activeView]);

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

  useEffect(() => {
    if (activeView === 'home' && isNearBottomRef.current) {
      // When entering the feed, request scroll to the latest post unless the user had scrolled up
      queueScrollToBottom();
    }
  }, [activeView, queueScrollToBottom]);

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
      requestAnimationFrame(() => requestAnimationFrame(scrollToBottomImmediate));
      return;
    }

    if (pendingScrollToBottom.current && (autoScrollEnabled || forceScrollToBottom.current)) {
      pendingScrollToBottom.current = false;
      forceScrollToBottom.current = false;
      requestAnimationFrame(scrollToBottomImmediate);
    }
  }, [activeView, feedItems.length, autoScrollEnabled, scrollToBottomImmediate]);

  const goToPrevPhoto = useCallback(() => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  }, [currentPhotoIndex]);

  const goToNextPhoto = useCallback(() => {
    if (currentPhotoIndex < galleryPhotos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  }, [currentPhotoIndex, galleryPhotos.length]);

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
    const shouldRefresh = pullDistanceRef.current > 60 && atTop;

    if (pullDistanceRef.current !== 0) {
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    if (shouldRefresh) {
      refreshFeed('pull');
    }

    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNextPhoto();
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
      target.closest('.refresh-btn') ||
      target.closest('.notification-banner') ||
      target.closest('.bottom-sheet') ||
      target.closest('.modal') ||
      target.closest('.modal-overlay')
    ) {
      return;
    }
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

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  const handleManualRefresh = useCallback(() => {
    if (actionLock || loadingPostsRef.current) return;
    startActionLock();
    refreshFeed('manual');
  }, [actionLock, refreshFeed, startActionLock]);

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
    } catch (err) {
      console.error('[data] Failed to send direct message', err);
      showToast('Failed to send message. Please try again.');
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

    setIsSavingPost(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const authorId = sessionData?.session?.user?.id ?? null;
    if (!authorId) {
      showToast('Please sign in to publish.');
      return;
    }
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
        const mapped = mapPostRowToMessage({ ...(data as PostRow), post_media: [], comments: [] }, adminUserIdRef.current);
        setFeedMessages((prev) => [...prev, mapped]);
        queueScrollToBottom({ force: true });
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

          const { data: updatedPost, error: updateError } = await supabase
            .from('posts')
            .update({
              metadata: {
                ...baseMetadata,
                image_urls: imageUrls,
                video_url: videoUrl,
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
          showToast('Audio post published.');
          resetAudioSelection();
        } catch (err) {
          await cleanupPostAndMedia(newPostId, uploadedPaths);
          throw err;
        }
      } else if (createTab === 'poll') {
        const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (!pollQuestion.trim() || trimmedOptions.length < 2) return;
        const { data, error } = await supabase
          .from('posts')
          .insert({
            author_id: authorId,
            type: 'poll',
            body_text: pollQuestion.trim(),
            visibility: 'public',
            metadata: {
              poll_question: pollQuestion.trim(),
              poll_options: trimmedOptions.slice(0, 4),
              time_label: timeLabel,
            },
          })
          .select()
          .single();
        if (error) throw error;
        const mapped = mapPostRowToMessage({ ...(data as PostRow), post_media: [], comments: [] }, adminUserIdRef.current);
        setFeedMessages((prev) => [...prev, mapped]);
        queueScrollToBottom({ force: true });
        showToast('Poll published.');
        setPollQuestion('');
        setPollOptions(['', '']);
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
          ? `Failed to save media post: ${errorMessage}`
          : 'Failed to save post. Please try again.';
      showToast(toastMessage);
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleAddPhotoDaySave = () => {
    if (!isAdmin) return;
    if (newPhotoDayFiles.length === 0) return;
    const today = new Date();
    const defaultDate = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const defaultTime = today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const newPhotos: Photo[] = newPhotoDayFiles.map((file, i) => ({
      id: `pd-${Date.now()}-${i}`,
      url: newPhotoDayPreviews[i] || '',
      date: newPhotoDayDates[i]?.trim() || defaultDate,
      time: newPhotoDayTimes[i]?.trim() || defaultTime,
      description: newPhotoDayDescs[i] || '',
    }));
    setGalleryPhotos((prev) => {
      const next = [...prev, ...newPhotos];
      setCurrentPhotoIndex(next.length - 1);
      return next;
    });
    setAddPhotoDayOpen(false);
    setNewPhotoDayFiles([]);
    setNewPhotoDayPreviews([]);
    setNewPhotoDayDescs([]);
    setNewPhotoDayDates([]);
    setNewPhotoDayTimes([]);
    showToast(`${newPhotos.length} Photo(s) of the Day added (mock).`);
  };

  const handleSendComment = async () => {
    if (!isAdmin || !activeMessageId) return;
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
    } catch (err) {
      console.error('[data] Failed to send comment', err);
      showToast('Failed to send comment.');
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
          return (
            <div
              key={msg.id}
              className="message"
              style={{
                marginLeft: isArtist ? 'var(--space-md)' : 'auto',
                marginRight: isArtist ? undefined : 'var(--space-md)',
              }}
            >
              <div className="message__bubble message__bubble--text">
                <p className="message__handwriting">{msg.text}</p>
                <div className="message__meta">
                  {msg.date ? `${msg.date} • ${msg.time}` : msg.time}
                </div>
              </div>
            </div>
          );
        })}
        <textarea
          className="write-view__textarea"
          placeholder={isAdmin ? "What's on your mind..." : 'Sign in as admin to write.'}
          value={writeText}
          onChange={(e) => {
            if (!isAdmin) return;
            setWriteText(e.target.value);
          }}
          disabled={!isAdmin}
        />
      </div>
      {isAdmin && (
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
              if (images.length === 0) return null;
              return (
                <div
                  key={msg.id}
                  className="gallery-item"
                  onClick={() => openPostGallery(images)}
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
              <img src={currentPhoto.url} alt="Photo of the day" className="fullscreen-bg__image" />
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
                {currentPhotoIndex > 0 && (
                  <button className="photo-header__nav-btn" onClick={(e) => { e.stopPropagation(); goToPrevPhoto(); }}>
                    ‹
                  </button>
                )}
                {currentPhotoIndex < galleryPhotos.length - 1 && (
                  <button className="photo-header__nav-btn" onClick={(e) => { e.stopPropagation(); goToNextPhoto(); }}>
                    ›
                  </button>
                )}
              </div>
              <div className="photo-header__info">
                <div className="photo-header__label-row">
                  <div className="photo-header__label">Photo of the day</div>
                  {currentPhoto.description && (
                    <button className="photo-header__about-chip" onClick={(e) => { e.stopPropagation(); setPhotoAboutOpen(true); }}>
                      about
                    </button>
                  )}
                </div>
                <div className="photo-header__date">{currentPhoto.date} • {currentPhoto.time}</div>
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
              {feedItems.map((item) => {
                // Skip date dividers - date is now shown in message__meta
                if (item.type === 'date') return null;
                const message = item.message;
                return (
                  <div key={message.id} className="feed-item">
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
                    />
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
                  scrollToBottomSmooth();
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
                  onClick={handleAddPhotoDaySave}
                  disabled={newPhotoDayFiles.length === 0}
                >
                  Publish {newPhotoDayFiles.length > 0 ? `(${newPhotoDayFiles.length})` : ''} (Mock)
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

      {photoAboutOpen && currentPhoto.description && (
        <div className="modal-overlay" onClick={() => setPhotoAboutOpen(false)}>
          <div className="modal about-modal" onClick={(e) => e.stopPropagation()}>
            <div className="about-modal__header">
              <div className="about-modal__title">About this photo</div>
              <button className="about-modal__close" onClick={() => setPhotoAboutOpen(false)}>
                {Icons.close}
              </button>
            </div>
            <p className="about-modal__text">{currentPhoto.description}</p>
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
              {commentsForActiveMessage.map((comment) => (
                <div key={comment.id} className="comment" style={{ position: 'relative' }}>
                  <div
                    className="comment__author"
                    style={{
                      color: comment.author === 'Kareevsky' ? 'var(--accent)' : undefined,
                    }}
                  >
                    {comment.author}
                  </div>
                  <div className="comment__text">{comment.text}</div>
                </div>
              ))}
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
}: MessageBubbleProps) {
  const [i18nSelectedLang, setI18nSelectedLang] = useState<I18nLang>('en');
  const [i18nImageIndex, setI18nImageIndex] = useState(0);

  // Deterrence only: not DRM and cannot block screen recording
  const isReader = !isAdmin;
  const deterrentClass = isReader ? 'deterrent-content' : '';
  const handleContentContextMenu = isReader ? (event: React.MouseEvent) => event.preventDefault() : undefined;

  useEffect(() => {
    setI18nSelectedLang('en');
    setI18nImageIndex(0);
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
            <p className="message__handwriting">{content || ''}</p>
            <div className="message__meta">
              {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
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
              <img
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
    const options = (message.pollOptions || []).slice(0, 4);
    return (
      <div className="message">
        <div
          className={`message__bubble message__bubble--poll ${deterrentClass}`}
          onContextMenu={handleContentContextMenu}
        >
          <div className="poll__question">{question}</div>
          <div className="poll__options">
            {options.map((opt) => (
              <button
                key={opt}
                className="poll__option"
                type="button"
                onClick={() => onShowToast('Voting will be connected later (mock).')}
              >
                {opt}
              </button>
            ))}
          </div>
          {/* Date shown at bottom-right next to time */}
          <div className="message__meta">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'photo') {
    // Use message.caption if exists, else fallback to photoCaptions for backwards compat
    const caption = message.caption || photoCaptions[message.id];
    const photoSet = message.images && message.images.length > 0 ? message.images : message.imageUrl ? [message.imageUrl] : [];
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
          onClick={() => onOpenGallery(photoSet)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenGallery(photoSet);
            }
          }}
          onContextMenu={handleContentContextMenu}
        >
          {isReader && (
            <div
              className="deterrent-media-guard"
              aria-hidden="true"
              onClick={() => onOpenGallery(photoSet)}
            />
          )}
          {showGrid ? (
            <div className={`message__photo-grid message__photo-grid--${Math.min(displayPhotos.length, 4)}`}>
              {displayPhotos.map((src, idx) => (
                <div key={idx} className="message__photo-grid-item">
                  <img src={src} alt="" className="message__grid-image" />
                  {idx === displayPhotos.length - 1 && extraCount > 0 && (
                    <div className="message__photo-grid-more">+{extraCount}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <img src={photoSet[0]} alt="" className="message__image" />
          )}
          {/* Date shown at bottom-right next to time */}
          <div className="message__meta message__meta--photo">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
          </div>
        </div>

        {caption && (
          <div
            className={`message__caption-bubble ${deterrentClass}`}
            onContextMenu={handleContentContextMenu}
          >
            <p className="message__caption">{caption}</p>
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
          className={`message__bubble message__bubble--photo ${deterrentClass}`}
          style={{ width: 'auto', maxWidth: '100%' }}
          onContextMenu={handleContentContextMenu}
        >
          <AudioPostPlayer
            audioUrl={message.audioUrl}
            storagePath={message.audioStoragePath}
            isReader={isReader}
          />
          <div className="message__meta message__meta--photo">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
          </div>
        </div>

        {message.text && (
          <div
            className={`message__caption-bubble ${deterrentClass}`}
            style={{ marginTop: '10px' }}
            onContextMenu={handleContentContextMenu}
          >
            <p className="message__handwriting">{message.text}</p>
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
    return (
      <div className="message">
        <div
          className={`message__bubble message__bubble--photo ${deterrentClass}`}
          style={{ width: 'auto', maxWidth: '100%' }}
          onContextMenu={handleContentContextMenu}
        >
          <video
            src={message.videoUrl}
            controls
            controlsList={isReader ? 'nodownload' : undefined}
            playsInline
            preload="metadata"
            style={{ width: '100%', maxWidth: '280px', borderRadius: '16px', objectFit: 'contain' }}
          />
          <div className="message__meta message__meta--photo">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
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
        <p className="message__handwriting">{message.text}</p>
        {/* Date shown at bottom-right next to time */}
        <div className="message__meta">
          {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
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
