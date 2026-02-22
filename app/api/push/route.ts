import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/app/lib/supabaseServiceClient';
import { isAdminEmailServer } from '@/app/lib/admin.server';

type PushEventType = 'admin_new_post' | 'admin_dm_to_user' | 'user_dm_to_admin' | 'new_comment_to_admin';

type PushRequestBody = {
  eventType: PushEventType;
  postId?: string | null;
  toUserId?: string | null;
  messageText?: string | null;
  commentText?: string | null;
  deepLink?: string | null;
};

const EVENT_LABELS: Record<PushEventType, string> = {
  admin_new_post: 'Admin new post',
  admin_dm_to_user: 'Admin DM to user',
  user_dm_to_admin: 'User DM to admin',
  new_comment_to_admin: 'New comment to admin',
};

const ADMIN_ONLY_EVENTS = new Set<PushEventType>(['admin_new_post', 'admin_dm_to_user']);
const USER_EVENTS = new Set<PushEventType>(['user_dm_to_admin', 'new_comment_to_admin']);

const ONE_SIGNAL_API = 'https://api.onesignal.com/notifications';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, number[]>();

const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitMap.set(key, recent);
  return false;
};

setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((timestamps, key) => {
    const recent = timestamps.filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, recent);
  });
}, 60_000);

const toPreview = (value?: string | null, fallback = ''): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

const makeIdempotencyKey = (parts: Array<string | null | undefined>) => {
  const keySource = parts.filter(Boolean).join('|') || 'noop';
  return crypto.createHash('sha256').update(keySource).digest('hex').slice(0, 32);
};

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

async function authenticateRequest(req: Request): Promise<
  { ok: true; userId: string; email: string; isAdmin: boolean } | { ok: false; error: NextResponse }
> {
  const authHeader = (req.headers.get('authorization') || '').trim();
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, error: errorResponse('Missing or invalid Authorization header', 401) };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, error: errorResponse('Empty token', 401) };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.error('[push] Supabase service client unavailable');
    return { ok: false, error: errorResponse('Auth service unavailable', 500) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, error: errorResponse('Invalid or expired token', 401) };
  }

  const userId = data.user.id;
  const email = (data.user.email || '').trim().toLowerCase();
  const isAdmin = isAdminEmailServer(email);

  return { ok: true, userId, email, isAdmin };
}

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.error;

  const { userId, isAdmin } = auth;

  if (isRateLimited(userId)) {
    return errorResponse('Too many requests. Please wait a moment.', 429);
  }

  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  const adminUserId = process.env.ADMIN_USER_ID || process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_USER_ID;

  if (!appId || !restKey) {
    console.error('[push] Missing OneSignal env (app id or REST key).');
    return errorResponse('Push not configured', 500);
  }

  let body: PushRequestBody;
  try {
    body = (await req.json()) as PushRequestBody;
  } catch {
    return errorResponse('Invalid JSON payload');
  }

  const { eventType, postId, toUserId, messageText, commentText, deepLink } = body || {};
  if (!eventType || !(eventType in EVENT_LABELS)) {
    return errorResponse('Unsupported event type');
  }

  if (ADMIN_ONLY_EVENTS.has(eventType) && !isAdmin) {
    return errorResponse('Forbidden: admin-only event', 403);
  }
  if (USER_EVENTS.has(eventType) && isAdmin) {
    // Admin can also trigger user events if needed; no restriction here
  }

  const payload: Record<string, unknown> = {
    app_id: appId,
    data: {
      type: eventType,
      postId: postId || undefined,
      deepLink: deepLink || undefined,
    },
  };

  let idempotencyKey = makeIdempotencyKey([eventType, postId, toUserId, messageText, commentText, deepLink]);

  switch (eventType) {
    case 'admin_new_post': {
      payload['included_segments'] = ['Subscribed Users'];
      const title = 'New post from Kareevsky';
      const bodyText = toPreview(messageText || commentText || '', 'New media post');
      payload['headings'] = { en: title };
      payload['contents'] = { en: bodyText };
      payload['data'] = {
        type: 'post',
        postId,
        deepLink: deepLink || '/?open=latest',
      };
      idempotencyKey = makeIdempotencyKey([eventType, postId]);
      break;
    }
    case 'admin_dm_to_user': {
      if (!toUserId) return errorResponse('Missing toUserId for admin_dm_to_user');
      const title = 'Message from Kareevsky';
      const bodyText = toPreview(messageText, 'New message');
      payload['include_external_user_ids'] = [toUserId];
      payload['headings'] = { en: title };
      payload['contents'] = { en: bodyText };
      payload['data'] = {
        type: 'dm',
        deepLink: deepLink || '/messages',
      };
      idempotencyKey = makeIdempotencyKey([eventType, toUserId, messageText]);
      break;
    }
    case 'user_dm_to_admin': {
      if (!adminUserId) return errorResponse('Admin id/email not configured', 500);
      const title = 'New message to Kareevsky';
      const bodyText = toPreview(messageText, 'New inbox message');
      payload['include_external_user_ids'] = [adminUserId];
      payload['headings'] = { en: title };
      payload['contents'] = { en: bodyText };
      payload['data'] = {
        type: 'admin_inbox',
        deepLink: deepLink || '/admin/messages',
      };
      idempotencyKey = makeIdempotencyKey([eventType, adminUserId, messageText]);
      break;
    }
    case 'new_comment_to_admin': {
      if (!adminUserId) return errorResponse('Admin id/email not configured', 500);
      const title = 'New comment';
      const bodyText = toPreview(commentText, 'New comment on your post');
      payload['include_external_user_ids'] = [adminUserId];
      payload['headings'] = { en: title };
      payload['contents'] = { en: bodyText };
      payload['data'] = {
        type: 'comment',
        postId,
        deepLink: deepLink || (postId ? `/?open=post&postId=${postId}` : undefined),
      };
      idempotencyKey = makeIdempotencyKey([eventType, postId, commentText]);
      break;
    }
    default:
      return errorResponse('Unhandled event type');
  }

  try {
    const res = await fetch(ONE_SIGNAL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${restKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error');
      console.error(`[push] Failed (${eventType})`, text);
      return errorResponse('Push send failed', 502);
    }

    return NextResponse.json({ ok: true, idempotencyKey });
  } catch (err) {
    console.error(`[push] Exception during send (${eventType})`, err);
    return errorResponse('Push send error', 500);
  }
}
