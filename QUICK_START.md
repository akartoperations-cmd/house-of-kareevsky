# Quick Start Checklist

Follow these steps to get your Digital Sanctuary PWA up and running:

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Set Up Environment Variables
1. Copy `env.example` to `.env.local`
2. Fill in your values:
   - `NEXT_PUBLIC_SUPABASE_URL`: From your Supabase project settings
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: From your Supabase project settings  
   - `NEXT_PUBLIC_DIGISTORE_LINK`: Your payment/store URL

## Step 3: Set Up Supabase Database
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase/schema.sql`
4. Copy all SQL code and paste into the SQL Editor
5. Click **Run** to execute
6. Verify tables were created in **Table Editor**:
   - ✅ `users`
   - ✅ `content`
   - ✅ `comments`

## Step 4: Create PWA Icons (Optional but Recommended)
Create two icon files in the `public` folder:
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

You can use any square image. For now, you can use placeholder images or create simple colored squares.

## Step 5: Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 6: Test the Application

### Test Authentication
1. Click "Sign Up" on homepage
2. Create a test account
3. Verify you're redirected to content page
4. Check Supabase `users` table - your user should be there

### Test Premium Access
1. Go to Supabase Dashboard > Table Editor > `users`
2. Find your test user
3. Edit the user and set `is_premium` to `true`
4. Refresh your app
5. You should now see all content (not just public)

### Test Content Creation (via Supabase)
1. Go to Supabase Dashboard > Table Editor > `content`
2. Click "Insert row"
3. Add test content:
   - `title`: "Test Article"
   - `type`: "text"
   - `url`: "<p>This is a test article content.</p>"
   - `is_public`: `true`
4. Refresh your app - you should see the content

### Test Reader Settings
1. Click the gear icon (bottom right)
2. Try different font sizes, styles, and themes
3. Refresh page - settings should persist

## Common Issues & Solutions

**"Module not found" errors:**
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

**Supabase connection errors:**
- Verify environment variables are correct
- Check Supabase project is active
- Ensure `.env.local` file exists

**Can't see content:**
- Check user exists in `users` table
- Verify `is_premium` status
- Check RLS policies are enabled in Supabase

**PWA not installing:**
- Ensure you're on HTTPS (or localhost)
- Check `manifest.json` is accessible
- Verify icons exist in `public` folder

## Next Steps

1. **Add Real Content**: Use Supabase Table Editor or create an admin interface
2. **Customize Design**: Modify colors in `tailwind.config.ts`
3. **Set Up Payments**: Integrate with your payment provider
4. **Deploy**: Build and deploy to Vercel/Netlify

## Need Help?

- Check `SETUP.md` for detailed setup instructions
- Check `README.md` for project overview
- Check `PROJECT_SUMMARY.md` for feature list

Happy building! 🎨✨

