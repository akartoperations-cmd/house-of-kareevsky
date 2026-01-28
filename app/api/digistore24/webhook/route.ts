import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/app/lib/supabaseServiceClient';
import crypto from 'crypto';

export const runtime = 'nodejs';

type FormDataMap = Record<string, string>;

const parseEmail = (value: unknown) => (typeof value === 'string' ? value : '').trim().toLowerCase();

const firstString = (obj: FormDataMap, keys: string[]) => {
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

const shaPrefix = (value: string): string => (value || '').slice(0, 6);

const timingSafeEqualStr = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const computeDigistoreShaSign = (params: FormDataMap, passphrase: string): string => {
  // PHP reference (Generic IPN):
  // - sha512
  // - remove sha_sign/SHASIGN
  // - ksort (case-sensitive; convert_keys_to_uppercase=false)
  // - skip empty values (undefined/null/""/false)
  // - concat "$key=$value$passphrase" for each key, no separators
  // - hex digest upper-case
  const clean: FormDataMap = { ...params };
  delete clean.sha_sign;
  delete clean.SHASIGN;

  const keys = Object.keys(clean).sort(); // JS sort is case-sensitive by default
  let base = '';
  for (const key of keys) {
    const value = clean[key];
    if (value === '' || value === undefined || value === null) continue;
    // formData() gives strings, but keep the PHP "false" skip behavior too
    if (value === 'false') continue;
    base += `${key}=${value}${passphrase}`;
  }

  return crypto.createHash('sha512').update(base, 'utf8').digest('hex').toUpperCase();
};

export async function POST(request: Request) {
  // Digistore24 sends POST form-urlencoded like PHP $_POST, not JSON.
  const fd = await request.formData();
  const data: FormDataMap = {};
  fd.forEach((rawValue, key) => {
    if (key in data) return; // keep first value, like $_POST
    data[key] = typeof rawValue === 'string' ? rawValue : String(rawValue);
  });

  const passphrase = (process.env.DIGISTORE24_IPN_PASSWORD || '').trim();
  const event = firstString(data, ['event', 'event_type', 'type']);
  const apiMode = firstString(data, ['api_mode']);
  const isConnectionTest = event === 'connection_test';

  const receivedSha = firstString(data, ['sha_sign', 'SHASIGN']);
  const expectedSha = passphrase ? computeDigistoreShaSign(data, passphrase) : '';

  const keys = Object.keys(data).sort();
  let reason = 'ok';

  // connection_test всегда OK, даже если подпись отключена/невалидна.
  if (isConnectionTest) {
    reason = 'connection_test';
    console.log('[digistore24]', {
      event,
      api_mode: apiMode,
      keys,
      received_sha_sign: shaPrefix(receivedSha),
      expected_sha_sign: shaPrefix(expectedSha),
      reason,
    });
    return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  if (!passphrase) {
    reason = 'missing_passphrase';
    console.log('[digistore24]', {
      event,
      api_mode: apiMode,
      keys,
      received_sha_sign: shaPrefix(receivedSha),
      expected_sha_sign: shaPrefix(expectedSha),
      reason,
    });
    return new NextResponse('missing passphrase', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const receivedNorm = receivedSha.trim().toUpperCase();
  const expectedNorm = expectedSha.trim().toUpperCase();
  const ok = Boolean(receivedNorm) && timingSafeEqualStr(receivedNorm, expectedNorm);
  if (!ok) {
    reason = 'invalid_signature';
    console.log('[digistore24]', {
      event,
      api_mode: apiMode,
      keys,
      received_sha_sign: shaPrefix(receivedNorm),
      expected_sha_sign: shaPrefix(expectedNorm),
      reason,
    });
    return new NextResponse('ERROR: invalid sha signature', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  console.log('[digistore24]', {
    event,
    api_mode: apiMode,
    keys,
    received_sha_sign: shaPrefix(receivedNorm),
    expected_sha_sign: shaPrefix(expectedNorm),
    reason,
  });

  const email = parseEmail(
    firstString(data, [
      'email',
      'customer_email',
      'buyer_email',
      'billing_email',
      'payer_email',
      'consumer_email',
      'user_email',
    ]),
  );

  const orderId = firstString(data, ['order_id', 'orderId', 'transaction_id', 'transactionId']);
  const productId = firstString(data, ['product_id', 'productId']);
  const eventType = firstString(data, ['event', 'event_type', 'type', 'status', 'payment_status', 'order_status']);

  // Signature is valid. Process best-effort, without impacting the response body.
  try {
    if (!email) {
      return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const status = mapStatus(eventType);

    // Bind user_id if the user already exists in auth.users.
    let userId: string | null = null;
    try {
      const { data: userRows } = await supabase.schema('auth').from('users').select('id').eq('email', email).limit(1);
      userId = (Array.isArray(userRows) && userRows.length > 0 ? (userRows[0] as { id?: string }).id : null) || null;
    } catch (err) {
    }

    const nowIso = new Date().toISOString();
    const baseUpdate = {
      email,
      user_id: userId,
      status,
      digistore_order_id: orderId || null,
      digistore_product_id: productId || null,
      raw_event: data,
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
  }

  return new NextResponse('OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
