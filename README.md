# Digital Sanctuary

A production-ready Progressive Web App (PWA) for artists to share exclusive content with a close circle of subscribers. Built with Next.js 14, Supabase, Tailwind CSS, and Framer Motion.

## Features

### 🎨 Design System: "Clean & Warm Luxury"
- Warm whites, soft sand/beige tones
- Muted bronze/gold accents
- Elegant typography (Playfair Display, Merriweather, etc.)
- Spa-like, calming atmosphere

### 🔐 Authentication & Database
- Supabase authentication
- Row Level Security (RLS) policies
- Premium subscription management
- User profiles

### 🛡️ Content Protection
- Global CSS: `user-select: none`
- Disabled right-click context menu
- Custom audio/video players (hidden source URLs)
- Media Session API for background playback

### 📚 Content Management
- Text, audio, and video content
- Public and premium content tiers
- Blurred placeholders for non-premium users
- Content feed with filtering

### 💬 Social Features
- Comments system with shadow ban logic
- Heatmap reactions with sparkle animations
- Privacy-focused (no subscriber counts)

### 📖 Reader Experience
- Customizable font sizes (Normal, Large, Extra Large)
- 5 font styles (Classic, Elegant, Modern, Fashion, Retro)
- 3 themes (Light, Sepia, Dark)
- Settings persist in localStorage

### 📱 PWA Support
- Installable on iOS and Android
- Offline-ready manifest
- Custom icons and splash screens

## Getting Started

### Prerequisites
- Node.js 18+ 
- A Supabase project
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_DIGISTORE_LINK=https://your-digital-store-link.com
   ```

3. **Set up the database:**
   - Go to your Supabase project SQL Editor
   - Run the SQL from `supabase/schema.sql`
   - This creates all tables, RLS policies, and triggers

4. **Run the development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

The `supabase/schema.sql` file includes:
- **users** table: Extends Supabase auth with premium status
- **content** table: Stores all content (text, audio, video)
- **comments** table: Comment system with shadow ban support
- **RLS Policies**: Strict access control based on premium status
- **Triggers**: Automatic user profile creation on signup

### PWA Icons

Create and place these icons in the `public` folder:
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)

These are referenced in `public/manifest.json` for PWA installation.

## Project Structure

```
├── app/                    # Next.js 14 App Router
│   ├── auth/              # Authentication pages
│   ├── content/           # Content feed page
│   ├── globals.css        # Global styles with content protection
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/
│   ├── comments/          # Comments system
│   ├── content/           # Content display components
│   ├── media/             # Custom audio/video players
│   ├── reader-settings/   # Reader customization
│   ├── reactions/         # Reaction heatmap
│   ├── content-protection.tsx
│   └── navigation.tsx
├── lib/
│   ├── supabase/          # Supabase client setup
│   └── utils.ts           # Utility functions
├── public/
│   ├── manifest.json      # PWA manifest
│   └── [icons]            # PWA icons
├── supabase/
│   └── schema.sql         # Database schema
└── .cursorrules           # Project context and rules
```

## Key Technologies

- **Next.js 14** with App Router
- **Supabase** for authentication and database
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **TypeScript** for type safety
- **Radix UI** components (via shadcn/ui patterns)

## Customization

### Content Types
The app supports three content types:
- `text`: HTML content displayed in a reader-friendly format
- `audio`: Custom audio player with Media Session API
- `video`: Custom video player with fullscreen support

### Reader Settings
Users can customize:
- Font size: Normal, Large, Extra Large
- Font style: Classic, Elegant, Modern, Fashion, Retro
- Theme: Light (Cream), Sepia (Warm), Dark (Charcoal)

Settings are persisted in localStorage and applied globally.

## Production Deployment

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   - Connect your repository
   - Add environment variables
   - Deploy

3. **Configure Supabase:**
   - Set up production database
   - Configure RLS policies
   - Set up authentication providers

## License

Private project - All rights reserved.

## Support

For issues or questions, please contact the project maintainer.

