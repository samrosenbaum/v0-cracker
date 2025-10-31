# Fix Supabase Authentication Redirects

## Problem
Magic links and password reset emails are redirecting to `localhost` instead of your production Vercel app.

## Solution

### Step 1: Get Your Production URL
First, find your Vercel production URL:
```bash
vercel ls
```
Or check your latest deployment at: https://vercel.com/dashboard

Your URL will be something like: `https://casecracker-xxxxxx.vercel.app`

### Step 2: Configure Supabase URL Settings

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/rqcrewnggjmuldleouqd

2. **Navigate to Authentication Settings**
   - Click **Authentication** in the left sidebar
   - Click **URL Configuration**

3. **Set Site URL** (This is the main production URL)
   ```
   https://your-app.vercel.app
   ```
   Replace with your actual Vercel URL

4. **Add Redirect URLs** (These allow auth to redirect here)
   Add these URLs (one per line):
   ```
   http://localhost:3000/**
   http://localhost:3001/**
   https://your-app.vercel.app/**
   ```

   **Important:**
   - Use `/**` wildcard at the end
   - Add both localhost URLs for development
   - Add your production URL

5. **Save Changes**

### Step 3: Test

1. **In Production:**
   - Go to your Vercel app
   - Click "Forgot Password"
   - Check email - link should go to production URL

2. **In Development:**
   - Go to `http://localhost:3001`
   - Magic link should still work for local testing

## Alternative: Use Environment Variables

You can also set redirect URLs programmatically in your code:

```typescript
// In your auth code
const { data, error } = await supabase.auth.signInWithOtp({
  email: email,
  options: {
    emailRedirectTo: process.env.NODE_ENV === 'production'
      ? 'https://your-app.vercel.app'
      : 'http://localhost:3001'
  }
})
```

## Verification

After configuring:
1. Request a password reset from production
2. Check the email link URL - should point to your Vercel app
3. Click the link - should open your production app, not localhost

## Current Status

- ✅ Supabase is connected and working
- ⚠️ Redirect URLs need to be configured (follow steps above)
- 🔧 Once configured, auth will work in both development and production
