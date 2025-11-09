# Vercel Environment Variables Checklist

## If you're seeing 500 errors on your deployed Vercel site

Your environment variables in Vercel are either missing or not configured correctly.

### Step 1: Check Your Vercel Environment Variables

Go to: https://vercel.com/[your-username]/v0-cracker/settings/environment-variables

### Step 2: Ensure ALL These Variables Are Set

**Required Variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

**Optional Variables:**
```
OPENAI_API_KEY
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
```

### Step 3: Check Environment Scope

**CRITICAL**: Each variable must be enabled for the environments where you need it:
- ✅ Production (for main branch deployments)
- ✅ Preview (for PR preview deployments)
- ✅ Development (for `vercel dev` local development)

**Common mistake**: Variables only set for "Production" won't work on preview deployments!

### Step 4: Redeploy After Adding Variables

After adding/updating environment variables:
1. Go to: https://vercel.com/[your-username]/v0-cracker/deployments
2. Find your latest deployment
3. Click the "..." menu → "Redeploy"
4. Or push a new commit to trigger a deployment

Environment variables are **only applied during build time**, not runtime for some values. A redeploy is required.

### Step 5: Verify Variables Are Loaded

After redeployment, check your deployment logs:
1. Go to deployment → "Logs" tab
2. Look for errors like:
   - "SUPABASE_SERVICE_ROLE_KEY not set"
   - "Anthropic API key is not configured"

If you see these, the variables aren't loaded correctly.

### Common Issues

**Issue**: "I added the variables but still getting 500 errors"
**Solution**:
- Make sure you clicked "Save" after adding each variable
- Check that you selected the right environment scopes
- Trigger a new deployment (environment changes require rebuild)

**Issue**: "Variables work in Production but not Preview"
**Solution**:
- Go back to Environment Variables settings
- Edit each variable and ensure "Preview" is checked
- Redeploy the preview branch

**Issue**: "NEXT_PUBLIC_* variables are undefined in browser"
**Solution**:
- These must be set at build time
- Redeploy after adding them
- Check browser console: `console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)`

### Quick Test

After redeployment, open browser console on your site and run:
```javascript
fetch('/api/cases/test-case-id/analyze')
  .then(r => r.json())
  .then(console.log)
```

Should return: `{ message: 'Analysis endpoint is ready...', status: 200 }`
NOT: `{ error: '...', status: 500 }`

## For Local Development

If you want to run the app locally with `npm run dev`, you need a `.env.local` file:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Pull environment variables
vercel env pull .env.local
```

This downloads your Vercel environment variables to `.env.local` for local development.

**Or manually create `.env.local`:**
```bash
cp .env.example .env.local
# Then edit .env.local with the same values from your Vercel dashboard
```
