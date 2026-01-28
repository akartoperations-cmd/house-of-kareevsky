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

const verifyShaSign = (
  data: FormDataMap,
  ipnPassphrase: string,
): { ok: boolean; reason?: 'INVALID_SHA_SIGN' } => {
  const provided = (data.sha_sign || '').trim();
  if (!provided) return { ok: false, reason: 'INVALID_SHA_SIGN' };

  // Digistore24 Variant A: sha_sign = SHA-256 hex(lowercase) of:
  // "key=value" pairs for all fields except sha_sign, sorted by key, joined with "&"
  // and then append "&ipn_passphrase=PASS".
  const withoutSha: Record<string, string> = { ...data };
  delete withoutSha.sha_sign;

  const keys = Object.keys(withoutSha).sort((a, b) => a.localeCompare(b));
  const query = keys.map((k) => `${k}=${withoutSha[k] ?? ''}`).join('&');
  const base = `${query}&ipn_passphrase=${ipnPassphrase}`;

  const computed = crypto.createHash('sha256').update(base, 'utf8').digest('hex').toLowerCase();
  const providedNorm = provided.toLowerCase();
  if (!timingSafeEqualStr(computed, providedNorm)) return { ok: false, reason: 'INVALID_SHA_SIGN' };
  return { ok: true };
};

export async function POST(request: Request) {
  // Digistore24 sends application/x-www-form-urlencoded most of the time.
  // Parse as text, then URLSearchParams, then object.
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const data = Object.fromEntries(params.entries()) as FormDataMap;

  const ipnPassphrase = (process.env.DIGISTORE24_IPN_PASSWORD || '').trim();
  const ipnPassphrasePresent = Boolean(ipnPassphrase);
  const supabaseUrlPresent = Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim());
  const supabaseServiceRoleKeyPresent = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
  const shaIncoming = (data.sha_sign || '').trim();

  // Logs must not leak secrets.
  console.log('[digistore24] env DIGISTORE24_IPN_PASSWORD present:', ipnPassphrasePresent);
  console.log('[digistore24] env NEXT_PUBLIC_SUPABASE_URL present:', supabaseUrlPresent);
  console.log('[digistore24] env SUPABASE_SERVICE_ROLE_KEY present:', supabaseServiceRoleKeyPresent);
  console.log('[digistore24] sha_sign prefix:', shaPrefix(shaIncoming));

  if (!ipnPassphrase) {
    console.error('[digistore24] missing password');
    return new NextResponse('DIGISTORE24_IPN_PASSWORD missing', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const shaCheck = verifyShaSign(data, ipnPassphrase);
  if (!shaCheck.ok) {
    console.warn('[digistore24] invalid sha_sign');
    return new NextResponse('invalid sha_sign', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

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

  // sha_sign is valid. Per Variant A requirements: always return 200 + "OK".
  // Process the webhook best-effort without impacting the response.
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
