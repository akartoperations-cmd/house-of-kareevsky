-- Migration: Add i18n_pack column for multi-language posts
-- Created: 2025-12-23
-- Description: Adds a JSONB column to store multi-language content (4 languages: EN, ES, FR, IT)

-- =============================================================================
-- INSTRUCTIONS
-- =============================================================================
-- If you have an existing `posts` table, run this migration to add the i18n_pack column.
-- If you don't have a posts table yet, you can use the full table creation script below.

-- =============================================================================
-- OPTION A: Add column to existing posts table
-- =============================================================================

-- Add the i18n_pack JSONB column (nullable, for backward compatibility)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS i18n_pack JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN posts.i18n_pack IS 'Multi-language content pack. Schema: { mode: "screenshot" | "text", items: [{ lang: "en"|"es"|"fr"|"it", text?: string, imageUrl?: string }] }';

-- Optional: Add a check constraint to validate the structure
-- ALTER TABLE posts
-- ADD CONSTRAINT i18n_pack_valid_mode 
-- CHECK (
--   i18n_pack IS NULL 
--   OR (i18n_pack->>'mode' IN ('screenshot', 'text'))
-- );

-- =============================================================================
-- OPTION B: Create posts table from scratch (if it doesn't exist)
-- =============================================================================

-- CREATE TABLE IF NOT EXISTS posts (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('photo', 'text', 'sticker', 'poll', 'i18n')),
--   time TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   is_test BOOLEAN DEFAULT FALSE,
--   image_url TEXT,
--   images TEXT[],
--   text TEXT,
--   subtitle TEXT,
--   caption TEXT,
--   poll_question TEXT,
--   poll_options TEXT[],
--   i18n_pack JSONB DEFAULT NULL,
--   user_id UUID REFERENCES auth.users(id)
-- );

-- -- Enable RLS
-- ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- -- Policy for admin insert (adjust email as needed)
-- CREATE POLICY "Admin can insert posts" ON posts
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (auth.jwt() ->> 'email' = 'your-admin@email.com');

-- -- Policy for public read
-- CREATE POLICY "Anyone can read posts" ON posts
-- FOR SELECT
-- USING (true);

-- =============================================================================
-- EXAMPLE i18n_pack DATA
-- =============================================================================

-- Text bubble mode:
-- {
--   "mode": "text",
--   "items": [
--     { "lang": "en", "text": "Hello world!" },
--     { "lang": "es", "text": "¡Hola mundo!" },
--     { "lang": "fr", "text": "Bonjour le monde!" },
--     { "lang": "it", "text": "Ciao mondo!" }
--   ]
-- }

-- Screenshot mode:
-- {
--   "mode": "screenshot",
--   "items": [
--     { "lang": "en", "imageUrl": "https://example.com/en.jpg" },
--     { "lang": "es", "imageUrl": "https://example.com/es.jpg" },
--     { "lang": "fr", "imageUrl": "https://example.com/fr.jpg" },
--     { "lang": "it", "imageUrl": "https://example.com/it.jpg" }
--   ]
-- }

