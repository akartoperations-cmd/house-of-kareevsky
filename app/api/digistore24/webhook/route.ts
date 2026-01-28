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

const maskShaSign = (value: string): string => {
  if (!value) return '(empty)';
  if (value.length <= 6) return value.slice(0, 4) + '...';
  return value.slice(0, 6) + '...';
};

const isTestRequest = (payload: IncomingPayload): boolean => {
  // Empty payload = test
  if (Object.keys(payload).length === 0) return true;

  // No sha_sign = likely test
  const shaSign = firstString(payload, ['sha_sign']);
  if (!shaSign) return true;

  // No core business fields = connection test
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
  const productId = firstString(payload, ['product_id', 'productId']);

  const hasAnyCoreField = Boolean(email || orderId || eventType || productId);
  return !hasAnyCoreField;
};

const timingSafeEqualStr = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const verifyShaSign = (payload: IncomingPayload, ipnPassword: string): { ok: boolean; reason?: string } => {
  const provided = firstString(payload, ['sha_sign']).toLowerCase();
  if (!provided) return { ok: false, reason: 'MISSING_SHA_SIGN' };

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
  if (!timingSafeEqualStr(computed, provided)) return { ok: false, reason: 'INVALID_SHA_SIGN' };
  return { ok: true };
};

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  const method = request.method;

  // Parse payload
  const payload = await payloadToObject(request);

  // Safe logging
  const ipnPasswordPresent = Boolean((process.env.DIGISTORE24_IPN_PASSWORD || '').trim());
  const allowUnverifiedTest = (process.env.DIGISTORE24_IPN_ALLOW_UNVERIFIED_TEST || '').trim().toLowerCase() === 'true';
  const shaSign = firstString(payload, ['sha_sign']);
  const bodyKeys = Object.keys(payload).sort();

  console.log('[digistore24] --- Incoming Request ---');
  console.log('[digistore24] method:', method);
  console.log('[digistore24] content-type:', contentType);
  console.log('[digistore24] DIGISTORE24_IPN_PASSWORD present:', ipnPasswordPresent);
  console.log('[digistore24] DIGISTORE24_IPN_ALLOW_UNVERIFIED_TEST:', allowUnverifiedTest);
  console.log('[digistore24] body keys:', bodyKeys);
  console.log('[digistore24] sha_sign:', maskShaSign(shaSign));

  // Check if this is a test request
  const testRequest = isTestRequest(payload);
  console.log('[digistore24] isTestRequest:', testRequest);

  // TEST BYPASS: If allowed and this looks like a test, return OK immediately
  if (allowUnverifiedTest && testRequest) {
    console.log('[digistore24] TEST_BYPASS_USED');
    return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // Check IPN password is configured
  const ipnPassword = (process.env.DIGISTORE24_IPN_PASSWORD || '').trim();
  if (!ipnPassword) {
    console.error('[digistore24] IPN_PASSWORD_MISSING - env DIGISTORE24_IPN_PASSWORD not configured');
    return new NextResponse('IPN_PASSWORD_MISSING', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // Verify sha_sign
  const shaCheck = verifyShaSign(payload, ipnPassword);
  if (!shaCheck.ok) {
    console.warn('[digistore24] sha_sign verification failed:', shaCheck.reason);
    return new NextResponse(shaCheck.reason || 'INVALID_SHA_SIGN', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  console.log('[digistore24] sha_sign verification: OK');

  // From here: sha_sign is valid, process the webhook
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.error('[digistore24] SUPABASE_SERVICE_ROLE_KEY not configured.');
    return new NextResponse('SERVICE_ROLE_NOT_CONFIGURED', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
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
    console.warn('[digistore24] missing email in payload');
    return new NextResponse('MISSING_EMAIL', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const status = mapStatus(eventType);
  console.log('[digistore24] Processing order - email:', email, 'orderId:', orderId || '(none)', 'status:', status);

  // Bind user_id if the user already exists in auth.users.
  let userId: string | null = null;
  try {
    const { data } = await supabase.schema('auth').from('users').select('id').eq('email', email).limit(1);
    userId = (Array.isArray(data) && data.length > 0 ? (data[0] as { id?: string }).id : null) || null;
  } catch (err) {
    console.warn('[digistore24] Failed to look up auth.users by email (continuing).', err);
  }

  const nowIso = new Date().toISOString();

  try {
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
    console.error('[digistore24] Unexpected DB error.', err);
    return new NextResponse('UNEXPECTED_ERROR', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  console.log('[digistore24] Webhook processed successfully');
  return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
