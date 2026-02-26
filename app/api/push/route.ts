import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, any> & {
    id?: string;
    is_published?: boolean;
    title?: string;
    body_text?: string;
    user_id?: string;
    from_user_id?: string;
    to_user_id?: string;
    to_admin_id?: string;
    thread_id?: string;
  };
  old_record?: Record<string, any> & {
    id?: string;
    is_published?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const ONE_SIGNAL_API = 'https://api.onesignal.com/notifications';

const toPreview = (value?: string | null, fallback = ''): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

const timingSafeEqualStr = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

function getServiceClient(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

// ---------------------------------------------------------------------------
// OneSignal sender (fire-and-forget; never throws to caller)
// ---------------------------------------------------------------------------

async function sendOneSignalPush(payload: Record<string, unknown>, idempotencyKey: string): Promise<void> {
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restKey) {
    console.error('[push] ONESIGNAL_REST_API_KEY not configured – skipping send');
    return;
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
    const text = await res.text().catch(() => '');
    const bodyPreview = text.slice(0, 200);
    console.log('[push] OneSignal response', { status: res.status, bodyPreview });
    if (!res.ok) {
      console.error(`[push] OneSignal ${res.status}: ${bodyPreview || 'unknown'}`);
    }
  } catch (err) {
    console.error('[push] OneSignal request failed', err);
  }
}

// ---------------------------------------------------------------------------
// Table handlers
// ---------------------------------------------------------------------------

async function handlePostsEvent(
  type: WebhookPayload['type'],
  record: WebhookPayload['record'],
  oldRecord: WebhookPayload['old_record'],
): Promise<void> {
  const isPublished = record.is_published === true;
  const wasPublished = oldRecord?.is_published === true;

  console.log('[push][posts] event received', {
    type,
    recordId: record.id,
    recordIsPublished: record.is_published,
    hasOldRecord: !!oldRecord,
    oldRecordIsPublished: oldRecord?.is_published,
  });

  if (!isPublished) {
    console.log('[push][posts] skipped', 'record is_published != true');
    return;
  }

  // For UPDATE, avoid re-sending when we can see it was already published.
  // If old_record is missing, we still send; OneSignal idempotency prevents duplicates.
  if (type === 'UPDATE' && wasPublished) {
    console.log('[push][posts] skipped', 'already published (old_record.is_published == true)');
    return;
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  if (!appId) {
    console.log('[push][posts] skipped', 'missing ONESIGNAL_APP_ID');
    return;
  }

  const heading = record.title || 'New Post';
  const body = toPreview(record.body_text, 'A new post is available.');
  const idempotencyKey = `post_publish_${record.id}`;
  const url = record.id ? `https://www.houseofkareevsky.com/?open=post&postId=${record.id}` : undefined;

  console.log('[push][posts] sending', {
    reason: type === 'INSERT' ? 'INSERT is_published=true' : wasPublished ? 'unknown' : 'UPDATE published (or old_record missing)',
    recordId: record.id,
    idempotencyKey,
  });

  await sendOneSignalPush(
    {
      app_id: appId,
      included_segments: ['Subscribed Users'],
      headings: { en: heading },
      contents: { en: body },
      ...(url ? { url } : {}),
      data: { type: 'post', postId: record.id },
    },
    idempotencyKey,
  );
}

async function handleCommentsInsert(record: WebhookPayload['record']): Promise<void> {
  const adminUserId = process.env.ADMIN_USER_ID;
  const appId = process.env.ONESIGNAL_APP_ID;
  if (!adminUserId || !appId) return;

  if (record.user_id === adminUserId) return;

  const body = toPreview(record.body_text, 'New comment on your post');
  const idempotencyKey = `comment_${record.id}`;

  await sendOneSignalPush(
    {
      app_id: appId,
      include_external_user_ids: [adminUserId],
      headings: { en: 'New comment' },
      contents: { en: body },
      data: { type: 'comment', postId: record.post_id },
    },
    idempotencyKey,
  );
}

async function handleDirectMessagesInsert(record: WebhookPayload['record']): Promise<void> {
  const adminUserId = process.env.ADMIN_USER_ID;
  const appId = process.env.ONESIGNAL_APP_ID;
  if (!adminUserId || !appId) return;

  const idempotencyKey = `dm_${record.id}`;
  const body = toPreview(record.body_text, 'New message');

  if (record.from_user_id !== adminUserId) {
    // User -> Admin
    await sendOneSignalPush(
      {
        app_id: appId,
        include_external_user_ids: [adminUserId],
        headings: { en: 'New message' },
        contents: { en: body },
        data: { type: 'admin_inbox' },
      },
      idempotencyKey,
    );
    return;
  }

  // Admin -> User: determine recipient
  let recipientUserId: string | undefined = record.to_user_id ?? undefined;

  if (!recipientUserId && record.thread_id) {
    const supabase = getServiceClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('direct_messages')
          .select('from_user_id')
          .eq('thread_id', record.thread_id)
          .neq('from_user_id', adminUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data?.from_user_id) {
          recipientUserId = data.from_user_id;
        }
      } catch (err) {
        console.warn('[push] Failed to resolve DM recipient via thread_id', err);
      }
    }
  }

  if (!recipientUserId) {
    console.warn('[push] Admin DM: could not determine recipient – skipping notification');
    return;
  }

  await sendOneSignalPush(
    {
      app_id: appId,
      include_external_user_ids: [recipientUserId],
      headings: { en: 'Message from Kareevsky' },
      contents: { en: body },
      data: { type: 'dm' },
    },
    idempotencyKey,
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

function normalizeTableName(table: string): string {
  const trimmed = (table || '').trim();
  if (!trimmed) return trimmed;
  const lastDot = trimmed.lastIndexOf('.');
  return lastDot >= 0 ? trimmed.slice(lastDot + 1) : trimmed;
}

export async function POST(req: Request) {
  // --- Auth: only accept valid Supabase webhook calls ---
  const expectedSecret = (process.env.SUPABASE_DB_WEBHOOK_SECRET || '').trim();
  if (!expectedSecret) {
    console.error('[push] SUPABASE_DB_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const providedSecret = (req.headers.get('x-supabase-webhook-secret') || '').trim();
  if (!providedSecret || !timingSafeEqualStr(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Parse payload ---
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ received: true, note: 'invalid json' }, { status: 200 });
  }

  const { type, table, record, old_record } = payload;
  const normalizedTable = normalizeTableName(table);

  // --- Route by table + event ---
  try {
    if (normalizedTable === 'posts' && (type === 'INSERT' || type === 'UPDATE')) {
      await handlePostsEvent(type, record, old_record);
    } else if (normalizedTable === 'comments' && type === 'INSERT') {
      await handleCommentsInsert(record);
    } else if (normalizedTable === 'direct_messages' && type === 'INSERT') {
      await handleDirectMessagesInsert(record);
    }
  } catch (err) {
    console.error(`[push] Unhandled error processing ${normalizedTable || table}/${type}`, err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
