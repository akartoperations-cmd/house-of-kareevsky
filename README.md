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