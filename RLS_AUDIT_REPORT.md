# RLS Audit Report — House of Kareevsky PWA

> **Дата:** 2026-02-12  
> **Цель:** Подготовка к безопасному внедрению Row Level Security (RLS) в Supabase.  
> **Статус:** Только анализ. Код не менялся.

---

## 1) ЛОГИКА ДОСТУПА К ЛЕНТЕ/ПОСТАМ (SUBSCRIPTION GATING)

### 1.1. Точка входа: `useAccessRedirect` (клиентский guard)

**Файл:** `app/lib/useAccessRedirect.ts`

Каждая страница вызывает `useAccessRedirect('feed')` или `useAccessRedirect('welcome')`, чтобы решить — показать контент или перенаправить.

#### Ход проверки (evaluateAccess, строки 135–173):

```
1. checkAdmin(email)           → вызов POST /api/admin/status
2. checkSubscriptionActive()   → вызов POST /api/access/status  (пропускается, если isAdmin=true)
3. Решение:
   - Если session есть, но !isAdmin && !hasSubscription → signOut + redirect /welcome
   - target='feed'  и !isAdmin && !hasSubscription      → redirect /welcome
   - target='welcome' и (isAdmin || hasSubscription)    → redirect /
   - Иначе → status='allowed'
```

**Снипет (строки 138–155):**
```typescript
const hasSubscription = isAdmin ? true : await checkSubscriptionActive(nextSession);
// ...
if (nextSession && !isAdmin && !hasSubscription) {
  try { await supabase.auth.signOut(); } catch { ... }
  setState({ status: 'redirecting', session: null, isAdmin, hasActiveSubscription: false });
  ensureRedirect('/welcome');
  return;
}
```

### 1.2. Серверная проверка подписки: `/api/access/status`

**Файл:** `app/api/access/status/route.ts`

| Шаг | Условие | Результат |
|-----|---------|-----------|
| 1 | `email === ADMIN_EMAIL` | `active: true` (без запроса в БД) |
| 2 | `subscriptions.user_id = userId AND status = 'active'` | `active: true` |
| 3 | `subscriptions.email ILIKE email AND status = 'active'` | `active: true` |
| 4 | Ничего не найдено | `active: false` |

**Таблица:** `public.subscriptions`  
**Поля:** `id`, `user_id`, `email`, `status`  
**Клиент Supabase:** `getSupabaseServiceClient()` (service_role)  
**RLS не затрагивается:** запрос идёт через service_role, который обходит RLS.

**Снипет (строки 48–59):**
```typescript
const { data, error } = await supabase
  .from('subscriptions')
  .select('id,user_id,email,status')
  .eq('user_id', userId)
  .eq('status', 'active')
  .limit(1);
```

### 1.3. Серверная проверка при отправке magic link: `/api/access/send-link`

**Файл:** `app/api/access/send-link/route.ts`

Тот же паттерн: admin email → пропуск, иначе → `subscriptions.email ILIKE email AND status = 'active'`.

**Снипет (строки 41–48):**
```typescript
const { data, error } = await dataClient
  .from('subscriptions')
  .select('id,status')
  .ilike('email', email)
  .eq('status', 'active')
  .limit(1);
```

### 1.4. Таблица истинности (subscription gating)

> **Важно:** поле `expires_at` **НЕ ПРОВЕРЯЕТСЯ** ни в одном месте кода.  
> Единственное условие — `status = 'active'`.

| `status` | `expires_at` | Доступ? |
|----------|-------------|---------|
| `'active'` | `NULL` | **ДА** |
| `'active'` | будущее | **ДА** |
| `'active'` | прошлое | **ДА** (expires_at игнорируется!) |
| `'expired'` | любое | НЕТ |
| `'canceled'` | любое | НЕТ |
| `'refunded'` | любое | НЕТ |
| `'chargeback'` | любое | НЕТ |
| `'pending'` | любое | НЕТ |
| (admin email) | — | **ДА** (без запроса в БД) |

**Риск:** Если webhook Digistore24 не обновит `status` вовремя, пользователь с `status='active'` и `expires_at` в прошлом сохранит доступ.

### 1.5. Webhook Digistore24 → статус-маппинг

**Файл:** `app/api/digistore24/webhook/route.ts` (строки 19–27)

```typescript
const mapStatus = (raw: string): string => {
  const v = (raw || '').toLowerCase();
  if (v.includes('success') || v.includes('completed') || v.includes('paid')) return 'active';
  if (v.includes('cancel')) return 'canceled';
  if (v.includes('unpaid') || v.includes('expired')) return 'expired';
  if (v.includes('refund')) return 'refunded';
  if (v.includes('chargeback')) return 'chargeback';
  return 'pending';
};
```

---

## 2) КАК ОПРЕДЕЛЯЕТСЯ "АДМИН" В ПРИЛОЖЕНИИ

### 2.1. Механизм: сравнение email с env-переменной (server-side)

**Файл:** `app/api/admin/status/route.ts`

```typescript
const parseAdminEmail = () =>
  (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();
// ...
const isAdmin = hasAdminEmail && email === adminEmail;
```

Нет запроса в БД. Нет JWT claims. Нет таблицы `public.users`. Просто `email === env.ADMIN_EMAIL`.

### 2.2. Клиентская проверка (useAccessRedirect)

**Файл:** `app/lib/useAccessRedirect.ts` (строки 32–78)

Клиент вызывает `POST /api/admin/status` с email текущей сессии. Ответ кешируется в `localStorage` (`admin_status_{email}`).

```typescript
const res = await fetch('/api/admin/status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: normalized }),
});
```

### 2.3. `ADMIN_USER_ID` — жёстко зашитый UUID (клиент)

**Файл:** `app/page.tsx` (строка 241)

```typescript
const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || null;
```

Используется как:
- начальное значение `adminUserIdRef` (строка 1230)
- `to_admin_id` при INSERT в `direct_messages` (строка 3570)
- для маппинга: "этот автор — художник или слушатель"

Если `NEXT_PUBLIC_ADMIN_USER_ID` не задан или указывает на неправильный UUID, то `adminUserIdRef` обновится при сессии (строки 1936–1938):

```typescript
if (access.isAdmin && user?.id) {
  adminUserIdRef.current = user.id;
}
```

### 2.4. `/api/access/status` — ещё одна проверка админа

**Файл:** `app/api/access/status/route.ts` (строки 16–27)

```typescript
const adminEmail = () => (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
// ...
const isAdmin = Boolean(adminEmail()) && email === adminEmail();
if (isAdmin) {
  return NextResponse.json({ ok: true, isAdmin: true, active: true });
}
```

### 2.5. `app/lib/access.ts` — утилитарная проверка (server-side)

**Файл:** `app/lib/access.ts` (строки 15–18)

```typescript
const isAdminEmail = (email: string): boolean => {
  const normalized = normalizeEmail(email);
  const adminEmail = parseAdminEmail();
  return Boolean(adminEmail) && normalized === adminEmail;
};
```

Также содержит `isEmailEligible()` с `ACCESS_ALLOWLIST_EMAILS` — используется в `/api/access/send-link` косвенно, но фактически **заменён на проверку через таблицу subscriptions** (allowlist не используется в send-link route).

### 2.6. Сводка: как определяется админ

| Механизм | Где | Приоритет | Риск |
|----------|-----|-----------|------|
| `email === ADMIN_EMAIL` (env) | API routes: `/api/admin/status`, `/api/access/status`, `/api/access/send-link` | **Главный** | Если env не задан — админа нет |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Fallback в `parseAdminEmail()` | Вторичный | Утечка email в клиентский bundle |
| `NEXT_PUBLIC_ADMIN_USER_ID` | `app/page.tsx`, для DM и маппинга | UUID mapping | Если UUID не тот — DM уходят не тому; mapPostRow путает автора |
| `adminUserIdRef.current = user.id` | `app/page.tsx` строки 1936–1938 | Перезапись при логине | Работает только если текущий сессионный юзер — админ |
| `localStorage admin_status_{email}` | `app/lib/useAccessRedirect.ts` | Кеш | Устаревший кеш → админ-статус "залипает" |

**Риск расхождения:** Если в `auth.users` два аккаунта с одним email (например, один magic link, один OAuth), то:
- `ADMIN_EMAIL` совпадёт по email для обоих
- `NEXT_PUBLIC_ADMIN_USER_ID` указывает на конкретный UUID → один из них "настоящий" админ
- Webhook `digistore24` берёт **первый** UUID из `auth.users` по email: `select('id').eq('email', email).limit(1)`

---

## 3) КАРТА ДОСТУПА ДАННЫХ (CLIENT → DB)

### Обозначения
- **BC** = Browser Client (anon key) — `getSupabaseBrowserClient()`
- **SC** = Service Client (service_role) — `getSupabaseServiceClient()` — обходит RLS
- **SRV** = Server Client (anon key, SSR) — `getSupabaseServerClient()`

---

### 3.1. `posts`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** | BC | `app/page.tsx:2218–2255` | `.from('posts').select('id, author_id, type, ...').eq('is_deleted', false).order('created_at', { ascending: false }).limit(FEED_PAGE_SIZE)` | `is_deleted`, `created_at`, вложенные `post_media`, `comments` |
| **SELECT** (пагинация) | BC | `app/page.tsx:2431–2469` | `.from('posts').select(...).eq('is_deleted', false).lt('created_at', oldestCursor)` | `is_deleted`, `created_at` |
| **INSERT** (text) | BC | `app/page.tsx:3936–3947` | `.from('posts').insert({ author_id, type: 'text', title, body_text, visibility: 'public', metadata })` | `author_id = session.user.id` |
| **INSERT** (media) | BC | `app/page.tsx:3978–3988` | `.from('posts').insert({ author_id, type: 'photo'/'video', body_text, visibility: 'public', metadata })` | `author_id` |
| **INSERT** (audio) | BC | `app/page.tsx:4122–4133` | `.from('posts').insert({ author_id, type: 'audio', ... })` | `author_id` |
| **INSERT** (poll) | BC | `app/page.tsx:4210–4224` | `.from('posts').insert({ author_id, type: 'poll', ... })` | `author_id` |
| **INSERT** (i18n) | BC | `app/page.tsx:4322–4332` / `4367–4377` | `.from('posts').insert({ author_id, type: 'i18n', ... })` | `author_id` |
| **UPDATE** (edit) | BC | `app/page.tsx:3637–3641` | `.from('posts').update({ body_text, updated_at }).eq('id', message.id).eq('author_id', currentUserId)` | `id`, `author_id` |
| **UPDATE** (soft delete) | BC | `app/page.tsx:3672–3676` | `.from('posts').update({ is_deleted: true, updated_at }).eq('id', message.id).eq('author_id', currentUserId)` | `id`, `author_id` |
| **UPDATE** (metadata) | BC | `app/page.tsx:4067–4078`, `4251–4262` | `.from('posts').update({ metadata }).eq('id', newPostId)` | `id` |
| **DELETE** (cleanup) | BC | `app/page.tsx:653` | `.from('posts').delete().eq('id', postId)` | `id` |

---

### 3.2. `post_media`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** | BC | `app/page.tsx:2232–2241` | Вложенный select через `posts.select('... post_media ( id, post_id, storage_path, media_type, width, height, duration, created_at )')` | через JOIN с posts |
| **INSERT** | BC | `app/page.tsx:4014` | `.from('post_media').insert(mediaRows).select()` | `post_id`, `storage_path`, `media_type` |
| **DELETE** (cleanup) | BC | `app/page.tsx:652` | `.from('post_media').delete().eq('post_id', postId)` | `post_id` |

---

### 3.3. `comments`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** | BC | `app/page.tsx:2242–2250` | Вложенный через `posts.select('... comments:comments ( id, post_id, user_id, body_text, created_at, updated_at, is_deleted )')` | через JOIN с posts |
| **INSERT** | BC | `app/page.tsx:4498–4506` | `.from('comments').insert({ post_id, user_id, body_text }).select().single()` | `post_id`, `user_id = session.user.id` |
| **UPDATE** (edit) | BC | `app/page.tsx:4561–4565` | `.from('comments').update({ body_text, updated_at }).eq('id', comment.id).eq('user_id', currentUserId)` | `id`, `user_id` |
| **UPDATE** (soft delete) | BC | `app/page.tsx:4602–4611` | `.from('comments').update({ is_deleted: true, updated_at }).eq('id', comment.id)` + `.eq('user_id', currentUserId)` (если не админ) | `id`, `user_id` (условно) |

**Важно:** Админ удаляет комментарии БЕЗ фильтра `user_id` (строки 4607–4608):
```typescript
if (!isAdmin) {
  query = query.eq('user_id', currentUserId || '');
}
```

---

### 3.4. `direct_messages`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** | BC | `app/page.tsx:2703–2717` | `.from('direct_messages').select('id, thread_id, from_user_id, to_admin_id, body_text, created_at, updated_at, is_deleted').order('created_at', { ascending: true })` | **Без фильтра по user!** Читает ВСЕ сообщения. |
| **INSERT** | BC | `app/page.tsx:3565–3574` | `.from('direct_messages').insert({ thread_id: null, from_user_id: userId, to_admin_id: adminUserIdRef.current, body_text }).select().single()` | `from_user_id`, `to_admin_id` |
| **UPDATE** (edit) | BC | `app/page.tsx:3726–3730` | `.from('direct_messages').update({ body_text, updated_at }).eq('id', msg.id).eq('from_user_id', currentUserId)` | `id`, `from_user_id` |
| **UPDATE** (soft delete) | BC | `app/page.tsx:3759–3763` | `.from('direct_messages').update({ is_deleted: true, updated_at }).eq('id', msg.id).eq('from_user_id', currentUserId)` | `id`, `from_user_id` |

**КРИТИЧНО:** SELECT `direct_messages` не имеет фильтра по `from_user_id` или `to_admin_id` — клиент загружает ВСЕ DM из таблицы. Сейчас RLS отключен, поэтому это работает. После включения RLS нужна policy, ограничивающая видимость.

---

### 3.5. `subscriber_profiles`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **UPSERT** (INSERT/UPDATE) | BC | `app/page.tsx:2758–2767` | `.from('subscriber_profiles').upsert({ user_id: user.id, email: user.email, display_name, locale, last_seen_at })` | `user_id` (PK) |

Выполняется при каждом логине. Нет SELECT со стороны клиента.

---

### 3.6. `subscriptions`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** | SC (service_role) | `app/api/access/status/route.ts:49–54` | `.from('subscriptions').select('id,user_id,email,status').eq('user_id', userId).eq('status', 'active')` | `user_id`, `status` |
| **SELECT** | SC (service_role) | `app/api/access/status/route.ts:63–68` | `.from('subscriptions').select('id,user_id,email,status').ilike('email', email).eq('status', 'active')` | `email`, `status` |
| **UPDATE** (bind user_id) | SC (service_role) | `app/api/access/status/route.ts:79` | `.from('subscriptions').update({ user_id }).eq('id', row.id)` | `id` |
| **SELECT** | SC (service_role) | `app/api/access/send-link/route.ts:41–46` | `.from('subscriptions').select('id,status').ilike('email', email).eq('status', 'active')` | `email`, `status` |
| **SELECT/INSERT/UPDATE** | SC (service_role) | `app/api/digistore24/webhook/route.ts:186–238` | Upsert-логика по `email` + `digistore_order_id` | `email`, `digistore_order_id`, `status` |

**Клиент (browser) НЕ обращается к `subscriptions` напрямую.** Все запросы через API routes с service_role.

---

### 3.7. `photo_of_day`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** (latest) | BC | `app/page.tsx:2638–2643` | `.from('photo_of_day').select('id, created_at, image_path, caption, created_by').order('created_at', { ascending: false }).limit(1)` | — |
| **SELECT** (пагинация) | BC | `app/page.tsx:3023–3034` | `.from('photo_of_day').select(...).order('created_at', { ascending: false }).limit(params.limit)` | `created_at` (cursor) |
| **SELECT** (preflight) | BC | `app/page.tsx:4428` | `.from('photo_of_day').select('id').limit(1)` | — |
| **INSERT** | BC | `app/page.tsx:4444` | `.from('photo_of_day').insert(insertRows)` | `image_path`, `caption`, `created_by`, `created_at` |

---

### 3.8. `polls`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** | BC | `app/page.tsx:2131–2145` | `.from('polls').select('id, post_id, question, poll_options ( id, option_text, poll_votes(count) )').in('post_id', pollPostIds)` | `post_id` |
| **INSERT** | BC | `app/page.tsx:4228–4235` | `.from('polls').insert({ post_id, question }).select().single()` | `post_id` |
| **DELETE** (cleanup) | BC | `app/page.tsx:4301` | `.from('polls').delete().eq('id', newPollId)` | `id` |

---

### 3.9. `poll_options`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** | BC | `app/page.tsx:2138–2142` | Вложенный через `polls.select('... poll_options ( id, option_text, poll_votes(count) )')` | через JOIN с polls |
| **INSERT** | BC | `app/page.tsx:4245–4248` | `.from('poll_options').insert(optionsToInsert).select()` | `poll_id`, `option_text` |

---

### 3.10. `poll_votes`

| Операция | Клиент | Файл | Сниппет | Фильтры/ключи |
|----------|--------|------|---------|----------------|
| **SELECT** (count) | BC | `app/page.tsx:2141` | Вложенный: `poll_votes(count)` через poll_options | агрегация |
| **SELECT** (user votes) | BC | `app/page.tsx:2154–2158` | `.from('poll_votes').select('poll_id, option_id').eq('user_id', currentUserId).in('poll_id', pollIds)` | `user_id`, `poll_id` |
| **INSERT** | BC | `app/page.tsx:3408–3412` | `.from('poll_votes').insert({ poll_id, option_id, user_id: currentUserId })` | `poll_id`, `option_id`, `user_id` |

---

### 3.11. `storage.objects` (bucket: `media`)

| Операция | Клиент | Файл | Сниппет |
|----------|--------|------|---------|
| **upload** | BC | `app/lib/mediaProvider.ts:119` | `.storage.from(bucket).upload(objectPath, file, { contentType, upsert: true })` |
| **createSignedUrl** | BC | `app/lib/mediaProvider.ts:61` | `.storage.from(bucket).createSignedUrl(objectPath, expiresIn)` |
| **createSignedUrls** (batch) | BC | `app/lib/mediaProvider.ts:86` | `.storage.from(bucket).createSignedUrls(paths, expiresIn)` |
| **getPublicUrl** | BC | `app/lib/mediaProvider.ts:65` | `.storage.from(bucket).getPublicUrl(objectPath)` |
| **remove** | BC | `app/page.tsx:661` | `.storage.from(MEDIA_BUCKET).remove(storagePaths)` |

---

### 3.12. `auth.users` (schema: auth)

| Операция | Клиент | Файл | Сниппет |
|----------|--------|------|---------|
| **SELECT** (id by email) | SC (service_role) | `app/api/digistore24/webhook/route.ts:170` | `supabase.schema('auth').from('users').select('id').eq('email', email).limit(1)` |

Только из webhook. Клиент не обращается.

---

### 3.13. `public.users`

**Не найдено в кодовой базе.** Таблица `public.users` не создаётся ни в одной миграции и не используется ни в одном запросе.

---

## 4) КАК ВЫБРАТЬ ПРАВИЛЬНЫЙ UUID "МЕНЯ" (если есть 2 записи с одной почтой)

### 4.1. Где берётся current user id

**Файл:** `app/page.tsx` (строки 1931–1938)

```typescript
useEffect(() => {
  setIsSignedIn(Boolean(session));
  setIsAdmin(access.isAdmin);
  setCurrentUserId(user?.id ?? null);
  if (access.isAdmin && user?.id) {
    adminUserIdRef.current = user.id;
  }
}, [access.isAdmin, session, user]);
```

Где `session` и `user` берутся из `useAccessRedirect`:

```typescript
const access = useAccessRedirect('feed');
// ...
const session = access.session;
const user = session?.user ?? null;
```

А `useAccessRedirect` берёт сессию из:
```typescript
supabase.auth.getSession()
  .then(({ data }) => evaluateAccess(data.session ?? null))
```

**Итого:** `currentUserId = session.user.id` = `auth.uid()` текущей сессии Supabase.

### 4.2. Debug-вывод (уже есть в коде!)

**Файл:** `app/page.tsx` (строки 1941–1948)

```typescript
useEffect(() => {
  if (typeof window !== 'undefined') {
    (window as any).__DEBUG_IS_ADMIN = isAdmin;
    (window as any).__DEBUG_CURRENT_USER_ID = currentUserId;
    console.log('[auth-debug] isAdmin:', isAdmin, 'currentUserId:', currentUserId);
  }
}, [isAdmin, currentUserId]);
```

### 4.3. Как узнать текущий UUID без изменений кода

Открыть DevTools Console в браузере и выполнить:

```javascript
// Способ 1: уже доступно через debug-переменную
console.log(window.__DEBUG_CURRENT_USER_ID);

// Способ 2: напрямую из Supabase
const { data } = await window.__supabase?.auth?.getSession?.() || {};
console.log(data?.session?.user?.id, data?.session?.user?.email);
```

Или проще — в логе консоли при загрузке страницы уже выводится:
```
[auth-debug] isAdmin: true currentUserId: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 4.4. Какой UUID "настоящий" при дублях

Если в `auth.users` два аккаунта с одним email:
- **Текущая сессия** определяет, какой UUID используется — тот, через который пользователь залогинился (magic link создаёт/находит конкретный аккаунт).
- Webhook Digistore24 берёт **первый** попавшийся: `select('id').eq('email', email).limit(1)` — порядок не гарантирован.
- `NEXT_PUBLIC_ADMIN_USER_ID` указывает на **один конкретный** UUID.

**Рекомендация:** Сравнить `window.__DEBUG_CURRENT_USER_ID` с `NEXT_PUBLIC_ADMIN_USER_ID` и с записями в `auth.users`. Убрать дубль или убедиться, что все три совпадают.

---

## 5) ЗАМЕТКИ ДЛЯ ГОТОВНОСТИ К RLS

### 5.1. Текущее состояние RLS по таблицам

| Таблица | RLS включён? | Есть policies? | Миграция |
|---------|-------------|----------------|----------|
| `posts` | **ДА** | ДА (select/insert/update/delete) | `20260105_enable_rls_and_policies.sql` |
| `post_media` | **ДА** | ДА (через parent post) | `20260105_enable_rls_and_policies.sql` |
| `comments` | **ДА** | ДА (select через parent post, insert/update/delete own) | `20260105_enable_rls_and_policies.sql` |
| `direct_messages` | **НЕТ** | НЕТ | `20260104_content_persistence.sql` (RLS disabled) |
| `subscriber_profiles` | **НЕТ** | НЕТ | `20260104_content_persistence.sql` (RLS disabled) |
| `subscriptions` | **НЕТ** | НЕТ | `supabase/subscriptions.sql` |
| `polls` | **НЕТ** | НЕТ | `20260114_add_polls.sql` (RLS disabled) |
| `poll_options` | **НЕТ** | НЕТ | `20260114_add_polls.sql` (RLS disabled) |
| `poll_votes` | **НЕТ** | НЕТ | `20260114_add_polls.sql` (RLS disabled) |
| `photo_of_day` | **НЕТ** | НЕТ | `20260208_photo_of_day.sql` |
| `storage.objects` | **ДА** | ДА (authenticated → bucket `media`) | `20260106_storage_rls_media.sql` |

### 5.2. Таблицы, которые ОБЯЗАНЫ иметь SELECT policy для `authenticated`

Если включить RLS на этих таблицах без policies — приложение **сломается**:

| Таблица | Почему обязательно | Кто читает |
|---------|-------------------|------------|
| `polls` | Загрузка ленты: вложенный SELECT для постов типа poll | BC (authenticated) |
| `poll_options` | Вложенный через `polls.select('... poll_options(...)')` | BC (authenticated) |
| `poll_votes` | Подсчёт голосов (count) + голоса текущего юзера | BC (authenticated) |
| `photo_of_day` | Фото дня: SELECT при каждом открытии gallery | BC (authenticated) |
| `direct_messages` | Личные сообщения: SELECT всех DM | BC (authenticated) |
| `subscriber_profiles` | UPSERT при логине (нужен INSERT + UPDATE на свою запись) | BC (authenticated) |

**`subscriptions`** — не сломается, т.к. клиент не обращается напрямую. Все запросы через service_role в API routes.

### 5.3. Приватные таблицы/поля — нельзя открывать лишним

| Таблица.Поле | Почему приватно | Рекомендация |
|--------------|-----------------|-------------|
| `subscriptions.raw_event` | Полный IPN-ивент Digistore24, может содержать платёжные данные | Не давать SELECT authenticated; доступ только через service_role |
| `subscriptions.email` | Email подписчика | Не давать SELECT другим подписчикам |
| `subscriptions.digistore_order_id` | ID заказа, финансовые данные | Не давать SELECT authenticated |
| `subscriber_profiles.email` | Email подписчика | Разрешить SELECT только своей записи (`auth.uid() = user_id`) |
| `subscriber_profiles.notes` | Внутренние заметки | Не давать SELECT authenticated или только свои |
| `direct_messages.body_text` | Содержание переписки | Только участники (from_user_id или to_admin_id = auth.uid()) |

### 5.4. Таблица `public.users`

**Не найдена в кодовой базе.** Ни в миграциях, ни в клиентском коде. Не используется. При включении RLS ничего не сломается, т.к. таблицы не существует (или она пуста и не запрашивается).

### 5.5. Проблемы текущих RLS policies (posts/post_media/comments)

**Файл:** `supabase/migrations/20260105_enable_rls_and_policies.sql`

1. **posts — INSERT/UPDATE/DELETE:** Только `auth.uid() = author_id`. Это значит:
   - Посты может создавать **только** тот, кто залогинен как автор (= админ по UUID).
   - Если `NEXT_PUBLIC_ADMIN_USER_ID` не совпадает с `auth.uid()` текущей сессии, INSERT будет отклонён RLS.

2. **comments — DELETE:** Только `auth.uid() = user_id`. Но в коде админ удаляет чужие комментарии без фильтра `user_id` (строки 4607–4608). Это будет **ЗАБЛОКИРОВАНО** текущей RLS policy. Нужна отдельная policy для админа.

3. **posts — SELECT:** `visibility = 'public' OR auth.uid() = author_id`. Все посты `visibility = 'public'`, так что SELECT работает. Но `TO public` (не `TO authenticated`!) значит даже `anon` видит посты — возможно, это не желаемое поведение после внедрения paywall.

---

## RLS POLICY CHECKLIST

### Таблицы без RLS — нужно включить:

- [ ] **`polls`** — включить RLS; добавить SELECT для authenticated; INSERT/DELETE для админа (post owner)
- [ ] **`poll_options`** — включить RLS; добавить SELECT для authenticated; INSERT для админа
- [ ] **`poll_votes`** — включить RLS; добавить SELECT для authenticated (свои голоса + count); INSERT для authenticated (свой голос)
- [ ] **`photo_of_day`** — включить RLS; добавить SELECT для authenticated; INSERT для админа
- [ ] **`direct_messages`** — включить RLS; добавить SELECT для участников (`from_user_id = auth.uid() OR to_admin_id = auth.uid()`); INSERT для authenticated
- [ ] **`subscriber_profiles`** — включить RLS; добавить UPSERT(INSERT+UPDATE) для `auth.uid() = user_id`; SELECT только своей записи

### Таблицы с RLS — нужно доработать policies:

- [ ] **`posts`** — SELECT policy: ограничить `TO authenticated` вместо `TO public` (если не хотите, чтобы anon видел контент)
- [ ] **`comments`** — добавить DELETE policy для админа (чтобы админ мог удалять чужие комментарии)
- [ ] **`posts`** — UPDATE метаданных после создания поста: текущая policy требует `auth.uid() = author_id` — убедиться, что `author_id` всегда устанавливается при INSERT

### Таблицы — оставить без клиентского доступа:

- [ ] **`subscriptions`** — RLS можно включить с restrictive policy; все запросы через service_role, клиент не ходит напрямую
- [ ] При включении RLS на `subscriptions`: policy для service_role не нужна (обходит RLS), но убедиться, что нет случайных запросов через anon/authenticated

### Storage:

- [ ] **`storage.objects`** (bucket `media`) — уже есть policies для authenticated. Проверить: нужен ли доступ для `anon` (если нет — текущие policies достаточны)

### Общие действия:

- [ ] Определить правильный UUID админа (сравнить `NEXT_PUBLIC_ADMIN_USER_ID` с `session.user.id` из debug-лога)
- [ ] Удалить или деактивировать дубликаты в `auth.users` по одному email
- [ ] Рассмотреть создание DB-функции `is_admin(uid)` для использования в RLS policies вместо хардкода UUID
- [ ] Проверить, нужно ли ограничить `expires_at` в логике доступа (сейчас не проверяется)
- [ ] Очистить `localStorage` кеш `admin_status_*` после изменения механизма админа
