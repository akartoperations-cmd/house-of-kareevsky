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

const validateSecret = (request: Request, payload: IncomingPayload): { ok: boolean; reason?: string } => {
  const configured = (process.env.DIGISTORE24_WEBHOOK_SECRET || '').trim();
  if (!configured) {
    console.warn('[digistore24/webhook] DIGISTORE24_WEBHOOK_SECRET is not set; skipping verification (dev-safe).');
    return { ok: true };
  }

  const headerSecret = (request.headers.get('x-digistore24-webhook-secret') || '').trim();
  const bodySecret =
    (typeof payload.webhook_secret === 'string' && payload.webhook_secret.trim()) ||
    (typeof payload.secret === 'string' && payload.secret.trim()) ||
    '';

  const provided = headerSecret || bodySecret;
  if (!provided) return { ok: false, reason: 'missing_secret' };
  if (provided !== configured) return { ok: false, reason: 'invalid_secret' };
  return { ok: true };
};

export async function POST(request: Request) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.error('[digistore24/webhook] SUPABASE_SERVICE_ROLE_KEY not configured.');
    return NextResponse.json({ ok: false, error: 'service_role_not_configured' }, { status: 500 });
  }

  const payload = await payloadToObject(request);

  const secretCheck = validateSecret(request, payload);
  if (!secretCheck.ok) {
    console.warn('[digistore24/webhook] Secret verification failed:', secretCheck.reason);
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
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
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_order_id' }, { status: 400 });
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
    const { error } = await supabase
      .from('subscriptions')
      .upsert(
        {
          email,
          user_id: userId,
          status,
          digistore_order_id: orderId,
          digistore_product_id: productId || null,
          raw_event: payload,
          last_event_at: nowIso,
        },
        { onConflict: 'email,digistore_order_id' },
      );

    if (error) {
      console.error('[digistore24/webhook] Upsert failed.', error);
      return NextResponse.json({ ok: false, error: 'upsert_failed' }, { status: 500 });
    }
  } catch (err) {
    console.error('[digistore24/webhook] Unexpected error.', err);
    return NextResponse.json({ ok: false, error: 'unexpected_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, orderId, status });
}

