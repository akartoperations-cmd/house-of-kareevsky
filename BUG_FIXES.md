# Bug Fixes - Language Filtering Implementation

## Bug 1: Stale Closure in Language Preferences ✅ FIXED

### Issue
The `toggleLanguage` function called `savePreferences` from within a state setter, causing `savePreferences` to capture a stale reference to `selectedLanguages`. When an error occurred during the database update, line 74 reverted to this stale value instead of the current state, causing language preferences to be reverted to an incorrect previous state.

### Root Cause
- `savePreferences` was called inside `setSelectedLanguages` callback
- On error, `setSelectedLanguages(selectedLanguages)` used a stale closure value
- This caused incorrect state reverts

### Fix Applied
1. Added `useRef` to track previous state: `previousLanguagesRef`
2. Store previous state in ref before updating: `previousLanguagesRef.current = prev`
3. Restructured `toggleLanguage` to:
   - Calculate new language list first
   - Update state (storing previous in ref)
   - Save preferences separately after state update
4. On error, revert using ref value: `setSelectedLanguages(previousLanguagesRef.current)`
5. On success, update ref to current state

### Files Changed
- `components/language/language-preferences.tsx`

---

## Bug 2: Insecure RLS Policies ✅ FIXED

### Issue
The RLS policies for content insertion and updating only checked if a user was authenticated, not if they had premium/admin status. While the UI restricted admin access to premium users, the database policies allowed any authenticated user to create and update content by directly calling the API, bypassing the application's access control.

### Root Cause
- Policies only checked: `auth.uid() IS NOT NULL`
- No check for `is_premium` or admin status
- Direct API calls could bypass UI restrictions

### Fix Applied
Updated both RLS policies to require premium status:

**Before:**
```sql
CREATE POLICY "Authenticated users can create content"
  ON public.content FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

**After:**
```sql
CREATE POLICY "Premium users can create content"
  ON public.content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_premium = TRUE
    )
  );
```

Applied same fix to UPDATE policy.

### Files Changed
- `supabase/language_filtering_migration.sql`

---

## Testing Recommendations

### Bug 1 Testing
1. Open language preferences in settings
2. Toggle a language
3. Simulate network error (disable network)
4. Verify state reverts to correct previous state (not stale)
5. Re-enable network and toggle again
6. Verify preferences save correctly

### Bug 2 Testing
1. Create a non-premium user account
2. Try to insert content via direct API call (should fail)
3. Try to update content via direct API call (should fail)
4. Upgrade user to premium
5. Verify content operations now succeed

---

## Security Impact

**Bug 2** was a critical security issue that allowed any authenticated user to:
- Create content bypassing UI restrictions
- Modify existing content
- Potentially corrupt the content database

This is now fixed at the database level, providing defense-in-depth security.

---

## Notes

- Both fixes maintain backward compatibility
- No breaking changes to existing functionality
- All changes follow React best practices
- Database policies match application logic

**Status**: ✅ Both bugs fixed and ready for testing

