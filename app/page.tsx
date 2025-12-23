'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
};

const photoCaptions: Record<string, string> = {
  m2: 'Evening light... there is something special about this hour',
  m4: 'Words on paper feel different than on screen',
  m7: 'Found this in an old notebook. Still true.',
};

// Branding constants (easy to rename later)
const BRANDING = {
  name: 'Kareevsky',
  prefix: 'House of',
  tagline: 'Private Atelier • Complete Works • Vlog',
};

export default function HomePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [activeView, setActiveView] = useState<View>('home');
  const [menuOpen, setMenuOpen] = useState(false);

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
  const [mediaCaption, setMediaCaption] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  // Multi-language post state
  const [i18nMode, setI18nMode] = useState<I18nMode>('text');
  const [i18nTexts, setI18nTexts] = useState<Record<I18nLang, string>>({ en: '', es: '', fr: '', it: '' });
  const [i18nFiles, setI18nFiles] = useState<Record<I18nLang, File | null>>({ en: null, es: null, fr: null, it: null });
  const [i18nPreviews, setI18nPreviews] = useState<Record<I18nLang, string>>({ en: '', es: '', fr: '', it: '' });
  const i18nFileInputRefs = useRef<Record<I18nLang, HTMLInputElement | null>>({ en: null, es: null, fr: null, it: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoAboutOpen, setPhotoAboutOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>(() => [...photos].reverse());
  const [addPhotoDayOpen, setAddPhotoDayOpen] = useState(false);
  const [newPhotoDayFiles, setNewPhotoDayFiles] = useState<File[]>([]);
  const [newPhotoDayPreviews, setNewPhotoDayPreviews] = useState<string[]>([]);
  const [newPhotoDayDescs, setNewPhotoDayDescs] = useState<string[]>([]);
  const [newPhotoDayDates, setNewPhotoDayDates] = useState<string[]>([]);
  const [newPhotoDayTimes, setNewPhotoDayTimes] = useState<string[]>([]);
  const [feedMessages, setFeedMessages] = useState<Message[]>(() => [...messages].reverse());
  const [galleryTab, setGalleryTab] = useState<GalleryTab>('photoOfDay');
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const pendingScrollToBottom = useRef(false);
  const didInitialScroll = useRef(false);
  const isPhotoOpen = Boolean(photoViewer);

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const lastTapTime = useRef<number>(0);

  const currentPhoto = galleryPhotos[currentPhotoIndex];
  const filteredMessages = feedMessages.filter(
    (m) => m.type !== 'sticker' && (!m.isTest || isAdmin), // hide test posts for non-admins
  );
  const savedMessages = filteredMessages.filter((m) => bookmarks[m.id]);
  const commentsForActiveMessage =
    activeMessageId && commentsByPostId[activeMessageId]
      ? commentsByPostId[activeMessageId]
      : fakeComments;
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration is best-effort; offline caching can be added later.
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone = isStandaloneDisplay();
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      event.preventDefault();
      setInstallPromptEvent(promptEvent);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setCanInstall(false);
      setInstallPromptEvent(null);
      setShowIosInstallHint(false);
      setIsStandalone(true);
    };

    if (!standalone && isIosSafari()) {
      setShowIosInstallHint(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (activeView !== 'home') return;

    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
      });
      return;
    }

    if (pendingScrollToBottom.current) {
      pendingScrollToBottom.current = false;
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [activeView, feedMessages.length]);

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

  const closePhotoViewer = () => {
    setPhotoViewer(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
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
    // Click catcher for the visible photo-of-the-day background.
    // If the click started on any interactive element or message bubble, do nothing.
    const target = e.target as HTMLElement;
    if (
      target.closest('.message') ||
      target.closest('.actions') ||
      target.closest('.emoji-panel') ||
      target.closest('.photo-header') ||
      target.closest('.menu-btn') ||
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

  const handleInstallClick = useCallback(async () => {
    if (!installPromptEvent) return;
    setCanInstall(false);
    try {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } catch {
      setCanInstall(Boolean(installPromptEvent));
    }
  }, [installPromptEvent]);

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
    setActiveView(view);
    setMenuOpen(false);
  };

  const goHome = () => setActiveView('home');

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

  const sendMessage = () => {
    if (!isAdmin) return;
    const text = writeText.trim();
    if (!text) return;
    const newMessage: PersonalMessage = {
      id: `l-${Date.now()}`,
      author: 'listener',
      time: 'now',
      date: 'Today',
      createdAt: new Date().toISOString(),
      text,
    };
    setPersonalMessages((prev) => [...prev, newMessage]);
    setAdminInbox((prev) => ({ hasUnread: true, count: prev.count + 1 }));
    showToast('Your message has been sent (mock).');
    setWriteText('');
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
  };

  const resetAudioSelection = () => {
    setAudioFile(null);
  };

  const addMoreMedia = (newFiles: File[]) => {
    if (mediaFiles.length + newFiles.length > 10) {
      showToast('Maximum 10 photos per post.', 2000);
      return;
    }
    const filtered = newFiles.filter((f) => f.type.startsWith('image/'));
    const newPreviews = filtered.map((f) => URL.createObjectURL(f));
    setMediaFiles((prev) => [...prev, ...filtered]);
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeMediaAtIndex = (idx: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const removePhotoDayAtIndex = (idx: number) => {
    setNewPhotoDayFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayPreviews((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayDescs((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayDates((prev) => prev.filter((_, i) => i !== idx));
    setNewPhotoDayTimes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateSave = () => {
    if (!isAdmin) return;
    if (createTab === 'text') {
      if (!createTextTitle.trim() && !createTextBody.trim()) return;
      const newMsg: Message = {
        id: `m-${Date.now()}`,
        type: 'text',
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        text: createTextBody.trim() || createTextTitle.trim(),
      };
      setFeedMessages((prev) => [...prev, newMsg]);
      pendingScrollToBottom.current = true;
      showToast('Text post published (mock).');
      setCreateTextTitle('');
      setCreateTextBody('');
    } else if (createTab === 'media') {
      if (mediaFiles.length === 0) return;
      const newMsg: Message = {
        id: `m-${Date.now()}`,
        type: 'photo',
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        imageUrl: mediaPreviews[0] || '',
        images: mediaPreviews,
        caption: mediaCaption.trim() || undefined,
      };
      setFeedMessages((prev) => [...prev, newMsg]);
      pendingScrollToBottom.current = true;
      showToast(`Photo post with ${mediaFiles.length} image(s) published (mock).`);
      setMediaFiles([]);
      setMediaPreviews([]);
      setMediaCaption('');
    } else if (createTab === 'audio') {
      if (!audioFile) return;
      showToast('Audio post saved (mock).');
      resetAudioSelection();
    } else if (createTab === 'poll') {
      const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (!pollQuestion.trim() || trimmedOptions.length < 2) return;
      const newMsg: Message = {
        id: `p-${Date.now()}`,
        type: 'poll',
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        pollQuestion: pollQuestion.trim(),
        pollOptions: trimmedOptions.slice(0, 4),
      };
      setFeedMessages((prev) => [...prev, newMsg]);
      pendingScrollToBottom.current = true;
      showToast('Poll published (mock).');
      setPollQuestion('');
      setPollOptions(['', '']);
    } else if (createTab === 'languages') {
      const langs: I18nLang[] = ['en', 'es', 'fr', 'it'];
      
      if (i18nMode === 'text') {
        // Validate all texts are filled
        const allFilled = langs.every((l) => i18nTexts[l].trim().length > 0);
        if (!allFilled) {
          showToast('Please fill in all 4 languages.');
          return;
        }
        const items: I18nItem[] = langs.map((lang) => ({
          lang,
          text: i18nTexts[lang].trim(),
        }));
        const pack: I18nPack = { mode: 'text', items };
        const newMsg: Message = {
          id: `i18n-${Date.now()}`,
          type: 'i18n',
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString(),
          i18nPack: pack,
        };
        setFeedMessages((prev) => [...prev, newMsg]);
        pendingScrollToBottom.current = true;
        showToast('Multi-language post published!');
        setI18nTexts({ en: '', es: '', fr: '', it: '' });
      } else {
        // Screenshot mode - validate all images are uploaded
        const allUploaded = langs.every((l) => i18nPreviews[l].length > 0);
        if (!allUploaded) {
          showToast('Please upload images for all 4 languages.');
          return;
        }
        const items: I18nItem[] = langs.map((lang) => ({
          lang,
          imageUrl: i18nPreviews[lang],
        }));
        const pack: I18nPack = { mode: 'screenshot', items };
        const newMsg: Message = {
          id: `i18n-${Date.now()}`,
          type: 'i18n',
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString(),
          i18nPack: pack,
        };
        setFeedMessages((prev) => [...prev, newMsg]);
        pendingScrollToBottom.current = true;
        showToast('Multi-language post published!');
        setI18nFiles({ en: null, es: null, fr: null, it: null });
        setI18nPreviews({ en: '', es: '', fr: '', it: '' });
      }
    } else {
      showToast('Saved (mock).');
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
    setGalleryPhotos((prev) => [...prev, ...newPhotos]);
    setCurrentPhotoIndex(galleryPhotos.length + newPhotos.length - 1);
    setAddPhotoDayOpen(false);
    setNewPhotoDayFiles([]);
    setNewPhotoDayPreviews([]);
    setNewPhotoDayDescs([]);
    setNewPhotoDayDates([]);
    setNewPhotoDayTimes([]);
    showToast(`${newPhotos.length} Photo(s) of the Day added (mock).`);
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
          <label className="create-label">Upload photos (1-10)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                if (mediaFiles.length === 0) {
                  // Initial selection
                  const filtered = files.filter((f) => f.type.startsWith('image/')).slice(0, 10);
                  const previews = filtered.map((f) => URL.createObjectURL(f));
                  setMediaFiles(filtered);
                  setMediaPreviews(previews);
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
                {mediaFiles.length} photo{mediaFiles.length !== 1 ? 's' : ''} selected
                {mediaFiles.length < 10 && (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    (max 10)
                  </span>
                )}
              </div>
              <div className="create-previews-grid">
                {mediaPreviews.map((src, i) => (
                  <div key={i} className="create-preview-wrapper">
                    <img src={src} alt="" className="create-preview-img" />
                    <button
                      type="button"
                      className="create-preview-remove"
                      onClick={() => removeMediaAtIndex(i)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {mediaFiles.length < 10 && (
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
              setAudioFile(file);
            }}
            className="create-input"
          />
          {audioFile && <div className="create-file-name">{audioFile.name}</div>}
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

      const handleI18nFileSelect = (lang: I18nLang, file: File | null) => {
        if (file && file.type.startsWith('image/')) {
          const preview = URL.createObjectURL(file);
          setI18nFiles((prev) => ({ ...prev, [lang]: file }));
          setI18nPreviews((prev) => ({ ...prev, [lang]: preview }));
        }
      };

      const removeI18nImage = (lang: I18nLang) => {
        setI18nFiles((prev) => ({ ...prev, [lang]: null }));
        setI18nPreviews((prev) => ({ ...prev, [lang]: '' }));
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
                    {i18nPreviews[code] ? (
                      <div className="i18n-preview-wrapper">
                        <img src={i18nPreviews[code]} alt={`${label} preview`} className="i18n-preview-img" />
                        <button
                          type="button"
                          className="i18n-preview-remove"
                          onClick={() => removeI18nImage(code)}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="i18n-upload-btn"
                        onClick={() => i18nFileInputRefs.current[code]?.click()}
                      >
                        {Icons.plus}
                        <span>Upload {label}</span>
                      </button>
                    )}
                    <input
                      ref={(el) => { i18nFileInputRefs.current[code] = el; }}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleI18nFileSelect(code, file);
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
              Save (mock)
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

            {/* Feed without date dividers - date shown in each message's meta */}
            <div className="feed feed--overlay">
              {feedItems.map((item) => {
                // Skip date dividers - date is now shown in message__meta
                if (item.type === 'date') return null;
                const message = item.message;
                return (
                  <div key={message.id} className="feed-item">
                    <MessageBubble
                      message={message}
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

            {hasUnreadAdminMessage && (
              <button className="notification-banner" onClick={openArtistMessage}>
                <span>New letter from Kareevsky</span>
                <span className="badge badge--pill">{unreadAdminCount}</span>
              </button>
            )}

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
            <div className="bottom-sheet__handle" />
            <div className="bottom-sheet__items">
              {canInstall && !isStandalone && (
                <button className="bottom-sheet__item" onClick={handleInstallClick}>
                  <span className="bottom-sheet__icon">{Icons.download}</span>
                  Add to Home Screen
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
        <div className="photo-viewer" onClick={closePhotoViewer}>
          <div className="photo-viewer__content" onClick={(e) => e.stopPropagation()}>
            <img
              src={photoViewer.images[photoViewer.index]}
              alt=""
              className="photo-viewer__image"
            />

            <button className="photo-viewer__close" onClick={closePhotoViewer} aria-label="Close">
              {Icons.close}
            </button>

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
                  {photoViewer.index + 1} / {photoViewer.images.length}
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
                      onClick={() => {
                        if (!isAdmin || !activeMessageId) return;
                        const text = commentReply.trim();
                        if (!text) return;
                        setCommentsByPostId((prev) => {
                          const existing = prev[activeMessageId] ?? fakeComments;
                          return {
                            ...prev,
                            [activeMessageId]: [...existing, { id: `c-${Date.now()}`, author: 'Kareevsky', text }],
                          };
                        });
                        setCommentReply('');
                      }}
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

      {showIosInstallHint && !isStandalone && (
        <div className="install-hint">
          <div className="install-hint__title">Add to Home Screen</div>
          <div className="install-hint__text">Share -&gt; Add to Home Screen</div>
          <button
            className="install-hint__close"
            type="button"
            aria-label="Dismiss add to home instructions"
            onClick={() => setShowIosInstallHint(false)}
          >
            ×
          </button>
        </div>
      )}

      {toastMessage && <div className="toast">{toastMessage}</div>}
    </>
  );
}

interface MessageBubbleProps {
  message: Message;
  isBookmarked: boolean;
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
  reaction,
  emojiPanelOpen,
  onSay,
  onBookmark,
  onReact,
  onSelectEmoji,
  onOpenGallery,
  onShowToast,
}: MessageBubbleProps) {
  const [i18nCarouselIndex, setI18nCarouselIndex] = useState(0);

  const langLabels: Record<I18nLang, { flag: string; code: string }> = {
    en: { flag: '🇬🇧', code: 'EN' },
    es: { flag: '🇪🇸', code: 'ES' },
    fr: { flag: '🇫🇷', code: 'FR' },
    it: { flag: '🇮🇹', code: 'IT' },
  };

  // Render i18n (multi-language) posts
  if (message.type === 'i18n' && message.i18nPack) {
    const { mode, items } = message.i18nPack;

    if (mode === 'text') {
      // Text bubble mode: render 4 stacked bubbles
      return (
        <div className="message message--i18n">
          <div className="i18n-bubbles">
            {items.map((item) => (
              <div key={item.lang} className="i18n-bubble">
                <div className="i18n-bubble__lang">
                  <span className="i18n-bubble__flag">{langLabels[item.lang].flag}</span>
                  <span className="i18n-bubble__code">{langLabels[item.lang].code}</span>
                </div>
                <div className="message__bubble message__bubble--text i18n-bubble__content">
                  <p className="message__handwriting">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="i18n-meta">
            {message.createdAt ? `${formatShortDate(message.createdAt)} • ${message.time}` : message.time}
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

    // Screenshot mode: render a carousel
    const currentItem = items[i18nCarouselIndex];
    const images = items.map((item) => item.imageUrl || '').filter(Boolean);

    return (
      <div className="message message--i18n">
        <div className="i18n-carousel">
          <div className="i18n-carousel__image-container">
            {currentItem.imageUrl && (
              <img
                src={currentItem.imageUrl}
                alt={`${langLabels[currentItem.lang].code} version`}
                className="i18n-carousel__image"
                onClick={() => onOpenGallery(images)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenGallery(images);
                  }
                }}
              />
            )}
            <div className="i18n-carousel__lang-badge">
              <span className="i18n-carousel__flag">{langLabels[currentItem.lang].flag}</span>
              <span className="i18n-carousel__code">{langLabels[currentItem.lang].code}</span>
            </div>
          </div>
          <div className="i18n-carousel__nav">
            {items.map((item, idx) => (
              <button
                key={item.lang}
                type="button"
                className={`i18n-carousel__dot ${idx === i18nCarouselIndex ? 'i18n-carousel__dot--active' : ''}`}
                onClick={() => setI18nCarouselIndex(idx)}
                aria-label={`Show ${langLabels[item.lang].code} version`}
              >
                {langLabels[item.lang].flag}
              </button>
            ))}
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
        <div className="message__bubble message__bubble--poll">
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
          className={`message__bubble message__bubble--photo ${showGrid ? 'message__bubble--grid' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onOpenGallery(photoSet)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenGallery(photoSet);
            }
          }}
        >
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
          <div className="message__caption-bubble">
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

  return (
    <div className="message">
      <div className="message__bubble message__bubble--text">
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
