# Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp env.example .env.local
   ```
   
   Then edit `.env.local` with your actual values:
   - Get Supabase URL and anon key from your Supabase project settings
   - Add your digital store link for premium subscriptions

3. **Set up Supabase Database:**
   - Go to your Supabase project
   - Navigate to SQL Editor
   - Copy and paste the contents of `supabase/schema.sql`
   - Run the SQL to create all tables, policies, and triggers

4. **Create PWA Icons:**
   - Create two icon files:
     - `public/icon-192.png` (192x192 pixels)
     - `public/icon-512.png` (512x512 pixels)
   - These should be square PNG images with your app logo

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Setup Details

The `supabase/schema.sql` file creates:

1. **Tables:**
   - `users` - User profiles with premium status
   - `content` - All content items (text, audio, video)
   - `comments` - Comment system with shadow ban support

2. **Security:**
   - Row Level Security (RLS) enabled on all tables
   - Strict policies ensuring only premium users see premium content
   - Users can only modify their own data

3. **Automatic Features:**
   - User profile auto-creation on signup
   - Timestamps on all records

## Testing Premium Access

To test premium features:

1. Sign up a new account
2. Go to Supabase Dashboard > Table Editor > `users`
3. Find your user and set `is_premium` to `true`
4. Refresh your app - you should now see all content

## Content Types

When adding content to the database:

- **type**: Must be one of `'text'`, `'audio'`, or `'video'`
- **url**: 
  - For text: HTML content string
  - For audio/video: URL to media file (hosted on Supabase Storage or external)
- **is_public**: `true` for free content, `false` for premium-only

## Deployment

For production deployment:

1. Build the project: `npm run build`
2. Deploy to Vercel/Netlify/etc.
3. Add environment variables in your hosting platform
4. Ensure Supabase is configured for production
5. Update RLS policies if needed for production

## Troubleshooting

**Issue**: Can't see content after signup
- Check that user was created in `users` table
- Verify RLS policies are set up correctly
- Check browser console for errors

**Issue**: PWA not installable
- Ensure `manifest.json` is accessible at `/manifest.json`
- Check that icons exist in `public` folder
- Verify HTTPS is enabled (required for PWA)

**Issue**: Media players not working
- Check that media URLs are accessible
- Verify CORS settings if hosting media externally
- Check browser console for errors

