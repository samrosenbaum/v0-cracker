# Setup Issues to Fix

## Summary
Your case data is fine and was never deleted! The issues were:
1. **Authentication session expired** - caused empty dashboard
2. **Supabase redirect URLs misconfigured** - password reset goes to localhost
3. **Anthropic API key issue** - the provided key is being rejected

## Fixes Needed

### 1. Fix Supabase Redirect URLs (IMPORTANT!)
**Problem:** Password reset emails redirect to localhost instead of your production app

**Fix:**
1. Go to https://supabase.com/dashboard/project/rqcrewnggjmuldleouqd
2. Navigate to: **Authentication → URL Configuration**
3. Set **Site URL** to your Vercel production URL (e.g., `https://casecracker.vercel.app`)
4. Under **Redirect URLs**, add:
   - `http://localhost:3000/**` (for development)
   - `http://localhost:3001/**` (backup port)
   - Your production URL with `/**` wildcard

### 2. Get Valid Anthropic API Key
**Problem:** The API key provided is being rejected by Anthropic (401 authentication error)

**Fix:**
1. Go to https://console.anthropic.com/settings/keys
2. Create a new API key (or verify your existing one)
3. Copy the FULL key (starts with `sk-ant-api03-...`)
4. Update `.env.local`:
   ```
   ANTHROPIC_API_KEY=your-new-key-here
   ```
5. Restart the dev server

### 3. Optional: Simplify Database Permissions
**Problem:** Complex RLS policies can hide data when auth fails

**Fix (if needed):**
- Run `EMERGENCY-FIX.sql` in Supabase SQL Editor
- This simplifies all permissions to: "if logged in, can do anything"
- Good for development, can add proper permissions later

## What I Fixed in This Session

✅ Added authentication checking to dashboard
✅ Auto-redirect to login if session expired
✅ Created `/timeline` API route (was missing, causing 404)
✅ Created emergency fix scripts for permissions
✅ Identified the real issue (auth session, not data loss)

## Current Status

- **Local Dev Server:** Running at http://localhost:3000
- **Your Case:** Visible after password reset (auth refresh)
- **Database:** All data intact
- **Remaining Issue:** Need valid Anthropic API key for AI analyses to work
