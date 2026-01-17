# House of Kareevsky

A clean start for a private messenger-like home for stories, songs and letters.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deployment

This project is ready to deploy on Netlify or Vercel.

## Environment checklist (dev & Netlify)

Frontend should use only the public Supabase anon key.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No service role or other secrets should be checked into the repo or used on the client.

## Push notifications (OneSignal)

This app uses the OneSignal Web SDK on the client (for permission + subscription) and the OneSignal REST API on the server (to send notifications).

- **Client (public)**:
  - `NEXT_PUBLIC_ONESIGNAL_APP_ID` (OneSignal App ID)
- **Server (secret)**:
  - `ONESIGNAL_REST_API_KEY` (OneSignal REST API Key)
  - `ONESIGNAL_APP_ID` (optional; if not set, the server will fall back to `NEXT_PUBLIC_ONESIGNAL_APP_ID`)

Admin-targeted events use OneSignal "external user id". Make sure the value you set in `ADMIN_USER_ID` / `NEXT_PUBLIC_ADMIN_USER_ID` matches what the client calls `OneSignal.login(...)` with.