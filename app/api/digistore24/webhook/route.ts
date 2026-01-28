import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/app/lib/supabaseServiceClient';

export const runtime = 'nodejs';

type IncomingPayload = Record<string, unknown>;

const parseEmail = (value: unknown) => (typeof value === 'string' ? value : '').trim().toLowerCase();

const firstString = (obj: IncomingPayload, keys: string[]) => {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

const mapStatus = (raw: string): string => {
  const v = (raw || '').toLowerCase();
  if (v.includes('success') || v.includes('completed') || v.includes('paid')) return 'active';
  if (v.includes('cancel')) return 'canceled';
  if (v.includes('unpaid') || v.includes('expired')) return 'expired';
  if (v.includes('refund')) return 'refunded';
  if (v.includes('chargeback')) return 'chargeback';
  return 'pending';
};

const payloadToObject = async (request: Request): Promise<IncomingPayload> => {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as IncomingPayload;
  }

  // Handle application/x-www-form-urlencoded
  const rawText = await request.text().catch(() => '');
  const params = new URLSearchParams(rawText);
  const obj: IncomingPayload = {};
  params.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
};

const validateSecret = (request: Request): { ok: boolean; reason?: string } => {
  const configured = (process.env.DIGISTORE24_WEBHOOK_SECRET || '').trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'secret_not_configured' };
    }
    console.warn('[digistore24/webhook] DIGISTORE24_WEBHOOK_SECRET is not set; skipping verification (dev-only).');
    return { ok: true };
  }

  const provided = (request.headers.get('x-digistore24-webhook-secret') || '').trim();
  if (!provided) return { ok: false, reason: 'missing_secret_header' };
  if (provided !== configured) return { ok: false, reason: 'invalid_secret' };
  return { ok: true };
};

export async function POST(request: Request) {
  const configuredSecret = (process.env.DIGISTORE24_WEBHOOK_SECRET || '').trim();
  const incomingSecret = (request.headers.get('x-digistore24-webhook-secret') || '').trim();
  const headerKeys = Array.from(request.headers.keys()).sort();
  console.log('[digistore24/webhook] Incoming headers:', headerKeys);
  console.log('[digistore24/webhook] x-digistore24-webhook-secret present:', Boolean(incomingSecret), 'len:', incomingSecret.length);
  console.log('[digistore24/webhook] DIGISTORE24_WEBHOOK_SECRET configured:', Boolean(configuredSecret));

  const payload = await payloadToObject(request);

  const secretCheck = validateSecret(request);
  if (!secretCheck.ok) {
    console.warn('[digistore24/webhook] Secret verification failed:', secretCheck.reason);
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Digistore24 "Test connection" may send an empty (or near-empty) payload. If the secret is valid,
  // acknowledge with 200 OK (plain text).
  const nonSecretKeys = Object.keys(payload).filter((k) => k !== 'secret' && k !== 'webhook_secret');
  if (nonSecretKeys.length === 0) {
    return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.error('[digistore24/webhook] SUPABASE_SERVICE_ROLE_KEY not configured.');
    return NextResponse.json({ ok: false, error: 'service_role_not_configured' }, { status: 500 });
  }

  const email = parseEmail(
    firstString(payload, [
      'email',
      'customer_email',
      'buyer_email',
      'billing_email',
      'payer_email',
      'consumer_email',
      'user_email',
    ]),
  );

  const orderId = firstString(payload, ['order_id', 'orderId', 'transaction_id', 'transactionId']);
  const productId = firstString(payload, ['product_id', 'productId']);
  const eventType = firstString(payload, ['event', 'event_type', 'type', 'status', 'payment_status', 'order_status']);

  if (!email) {
    return NextResponse.json({ ok: false, error: 'missing_email' }, { status: 400 });
  }

  const status = mapStatus(eventType);

  // Bind user_id if the user already exists in auth.users.
  let userId: string | null = null;
  try {
    const { data } = await supabase.schema('auth').from('users').select('id').eq('email', email).limit(1);
    userId = (Array.isArray(data) && data.length > 0 ? (data[0] as { id?: string }).id : null) || null;
  } catch (err) {
    console.warn('[digistore24/webhook] Failed to look up auth.users by email (continuing).', err);
  }

  const nowIso = new Date().toISOString();

  try {
    // Upsert rules:
    // - If orderId exists: idempotent by (lower(email), orderId) via partial unique index.
    // - If orderId missing: best-effort upsert by lower(email) (update latest NULL-order row, else insert).
    const baseUpdate = {
      email,
      user_id: userId,
      status,
      digistore_order_id: orderId || null,
      digistore_product_id: productId || null,
      raw_event: payload,
      last_event_at: nowIso,
    };

    if (orderId) {
      // Try update-first
      const existing = await supabase
        .from('subscriptions')
        .select('id')
        .ilike('email', email)
        .eq('digistore_order_id', orderId)
        .limit(1);

      const existingId =
        Array.isArray(existing.data) && existing.data.length > 0
          ? ((existing.data[0] as { id?: string }).id || null)
          : null;

      if (existingId) {
        const { error } = await supabase.from('subscriptions').update(baseUpdate).eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscriptions').insert(baseUpdate);
        if (error) {
          // Likely unique violation (duplicate webhook); retry as update.
          const retry = await supabase
            .from('subscriptions')
            .select('id')
            .ilike('email', email)
            .eq('digistore_order_id', orderId)
            .limit(1);
          const retryId =
            Array.isArray(retry.data) && retry.data.length > 0
              ? ((retry.data[0] as { id?: string }).id || null)
              : null;
          if (!retryId) throw error;
          const { error: updErr } = await supabase.from('subscriptions').update(baseUpdate).eq('id', retryId);
          if (updErr) throw updErr;
        }
      }
    } else {
      // No order id: update latest null-order row for this email, else insert.
      const existing = await supabase
        .from('subscriptions')
        .select('id')
        .ilike('email', email)
        .is('digistore_order_id', null)
        .order('last_event_at', { ascending: false })
        .limit(1);
      const existingId =
        Array.isArray(existing.data) && existing.data.length > 0
          ? ((existing.data[0] as { id?: string }).id || null)
          : null;
      if (existingId) {
        const { error } = await supabase.from('subscriptions').update(baseUpdate).eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscriptions').insert(baseUpdate);
        if (error) throw error;
      }
    }
  } catch (err) {
    console.error('[digistore24/webhook] Unexpected error.', err);
    return NextResponse.json({ ok: false, error: 'unexpected_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, orderId: orderId || null, status });
}

