import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/app/lib/supabaseServiceClient';
import crypto from 'crypto';

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

const maskValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (!v) return v;
  if (v.length <= 8) return `${v.slice(0, 2)}***`;
  return `${v.slice(0, 4)}***${v.slice(-3)}`;
};

const shouldMaskKey = (key: string) => {
  const k = key.toLowerCase();
  return (
    k.includes('secret') ||
    k.includes('password') ||
    k.includes('token') ||
    k.includes('key') ||
    k.includes('authorization') ||
    k.includes('signature') ||
    k.includes('sha_sign') ||
    k.includes('sign')
  );
};

const logRequest = (request: Request, payload: IncomingPayload) => {
  const headerObj: Record<string, unknown> = {};
  for (const [k, v] of request.headers.entries()) {
    headerObj[k] = shouldMaskKey(k) ? maskValue(v) : v;
  }

  const bodyObj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    bodyObj[k] = shouldMaskKey(k) ? maskValue(v) : v;
  }

  console.log('[digistore24/webhook] Incoming headers:', headerObj);
  console.log('[digistore24/webhook] Incoming body keys:', Object.keys(payload).sort());
  console.log('[digistore24/webhook] Incoming body (masked):', bodyObj);
};

const isConnectionTest = (payload: IncomingPayload) => {
  const email = firstString(payload, [
    'email',
    'customer_email',
    'buyer_email',
    'billing_email',
    'payer_email',
    'consumer_email',
    'user_email',
  ]);
  const orderId = firstString(payload, ['order_id', 'orderId', 'transaction_id', 'transactionId']);
  const eventType = firstString(payload, ['event', 'event_type', 'type', 'status', 'payment_status', 'order_status']);
  const shaSign = firstString(payload, ['sha_sign']);
  const hasAnyCoreField = Boolean(email || orderId || eventType || shaSign);
  return !hasAnyCoreField;
};

const timingSafeEqualStr = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const verifyShaSign = (payload: IncomingPayload): { ok: boolean; reason?: string } => {
  const ipnPassword = (process.env.DIGISTORE24_IPN_PASSWORD || '').trim();
  if (!ipnPassword) return { ok: false, reason: 'ipn_password_not_configured' };

  const provided = firstString(payload, ['sha_sign']).toLowerCase();
  if (!provided) return { ok: false, reason: 'missing_sha_sign' };

  // Generic IPN signature (sha_sign): concatenate values of all params (except sha_sign) sorted by key, append IPN password.
  const keys = Object.keys(payload)
    .filter((k) => k !== 'sha_sign')
    .sort((a, b) => a.localeCompare(b));

  let base = '';
  for (const k of keys) {
    const v = payload[k];
    if (v === null || typeof v === 'undefined') continue;
    base += String(v);
  }
  base += ipnPassword;

  const computed = crypto.createHash('sha512').update(base, 'utf8').digest('hex').toLowerCase();
  if (!timingSafeEqualStr(computed, provided)) return { ok: false, reason: 'invalid_sha_sign' };
  return { ok: true };
};

export async function POST(request: Request) {
  const payload = await payloadToObject(request);
  logRequest(request, payload);

  const allowUnverifiedTest = (process.env.DIGISTORE24_IPN_ALLOW_UNVERIFIED_TEST || '').trim().toLowerCase() === 'true';
  console.log('[digistore24/webhook] DIGISTORE24_IPN_ALLOW_UNVERIFIED_TEST:', allowUnverifiedTest);
  console.log('[digistore24/webhook] DIGISTORE24_IPN_PASSWORD configured:', Boolean((process.env.DIGISTORE24_IPN_PASSWORD || '').trim()));

  // Digistore24 "Test connection" (generic IPN) can be empty/partial. Always acknowledge it with 200 OK.
  // If it contains a sha_sign, we still log whether it verifies; but we don't block the test response.
  if (isConnectionTest(payload)) {
    const shaCheck = verifyShaSign(payload);
    if (!shaCheck.ok && !allowUnverifiedTest) {
      console.warn('[digistore24/webhook] Test connection sha_sign not valid (allowed anyway):', shaCheck.reason);
    }
    return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const shaCheck = verifyShaSign(payload);
  if (!shaCheck.ok) {
    console.warn('[digistore24/webhook] sha_sign verification failed:', shaCheck.reason);
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
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

