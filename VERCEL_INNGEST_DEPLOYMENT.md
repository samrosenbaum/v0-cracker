# 🚀 Vercel Deployment Guide - Inngest Keys

**Quick Reference: Add these exact keys to Vercel now**

---

## Copy-Paste Ready for Vercel Dashboard

Go to: **https://vercel.com/[your-username]/v0-cracker/settings/environment-variables**

Click **"Add New Variable"** and paste these:

### Variable 1: Event Key
```
Key:   INNGEST_EVENT_KEY
Value: eoqsTJrYiljDXrkQw6IZKdq7d9980aDnzMwtC8IQwr3KAEJdeB49t3P1KXLW0jlxKfHdSGYPF3PiWvb9kXVU4Q
```
✅ Check: Production
✅ Check: Preview
✅ Check: Development

---

### Variable 2: Signing Key
```
Key:   INNGEST_SIGNING_KEY
Value: signkey-prod-50f567a261bc3a3588aa3d29fe67a2904ebdc1376758a898b372f39b290eb434
```
✅ Check: Production
✅ Check: Preview
✅ Check: Development

---

## Step-by-Step Instructions

### 1. Open Vercel Dashboard
- Go to https://vercel.com
- Click on your **v0-cracker** project
- Click **"Settings"** tab
- Click **"Environment Variables"** in the sidebar

### 2. Add INNGEST_EVENT_KEY
- Click **"Add New"** button
- In the **"Key"** field, enter: `INNGEST_EVENT_KEY`
- In the **"Value"** field, paste:
  ```
  eoqsTJrYiljDXrkQw6IZKdq7d9980aDnzMwtC8IQwr3KAEJdeB49t3P1KXLW0jlxKfHdSGYPF3PiWvb9kXVU4Q
  ```
- Check all three boxes: **Production**, **Preview**, **Development**
- Click **"Save"**

### 3. Add INNGEST_SIGNING_KEY
- Click **"Add New"** button again
- In the **"Key"** field, enter: `INNGEST_SIGNING_KEY`
- In the **"Value"** field, paste:
  ```
  signkey-prod-50f567a261bc3a3588aa3d29fe67a2904ebdc1376758a898b372f39b290eb434
  ```
- Check all three boxes: **Production**, **Preview**, **Development**
- Click **"Save"**

### 4. Redeploy Your Application
After adding both variables, you **MUST** redeploy:

**Option A: Via Dashboard**
- Go to **"Deployments"** tab
- Click on the latest deployment
- Click the **"..."** (three dots) menu
- Select **"Redeploy"**
- Confirm the redeployment

**Option B: Via Git Push**
- Make any small change (or empty commit)
- Push to your repository
- Vercel will automatically redeploy

**Option C: Via Vercel CLI**
```bash
vercel --prod
```

### 5. Verify the Deployment
After redeployment completes:

1. **Check Vercel Logs**
   - Go to your latest deployment
   - Click **"Functions"** tab
   - Check `/api/inngest` function logs
   - Look for successful Inngest initialization

2. **Check Inngest Dashboard**
   - Go to https://app.inngest.com/
   - Navigate to **"Functions"** tab
   - You should see 13 functions registered:
     - `chunk-document`
     - `process-chunk`
     - `aggregate-document`
     - `generate-embeddings`
     - `populate-investigation-board`
     - `process-timeline-analysis`
     - `process-deep-analysis`
     - `process-victim-timeline`
     - `process-behavioral-patterns`
     - `process-evidence-gaps`
     - `process-relationship-network`
     - `process-similar-cases`
     - `process-overlooked-details`
     - `process-interrogation-questions`
     - `process-forensic-retesting`

3. **Test the Integration**
   - Visit your deployed app
   - Upload a test document to a case
   - Go to Inngest dashboard → **"Events"** tab
   - You should see `document/uploaded` event appear
   - Click on the event to see job execution

---

## 🔍 Troubleshooting

### Variables Not Taking Effect
**Problem:** Added variables but still getting errors

**Solution:**
1. Ensure you clicked **"Save"** for each variable
2. **Redeploy** the app after adding variables
3. Wait 1-2 minutes for deployment to complete
4. Hard refresh your browser (Ctrl+Shift+R / Cmd+Shift+R)

### Functions Not Appearing in Inngest
**Problem:** Inngest dashboard shows no functions

**Solution:**
1. Verify both keys are added to Vercel (check Settings → Environment Variables)
2. Check the signing key is exactly: `signkey-prod-50f567a261bc3a3588aa3d29fe67a2904ebdc1376758a898b372f39b290eb434`
3. Redeploy the app
4. Visit `/api/inngest` endpoint directly: `https://your-app.vercel.app/api/inngest`
5. Check Inngest dashboard after a few minutes

### Webhook Verification Errors
**Problem:** Getting 401/403 errors in Inngest logs

**Solution:**
1. Double-check `INNGEST_SIGNING_KEY` has no extra spaces
2. Ensure it starts with `signkey-prod-`
3. Re-enter the signing key in Vercel (delete and re-add)
4. Redeploy

### Events Not Being Sent
**Problem:** Triggering actions but no events in Inngest

**Solution:**
1. Check `INNGEST_EVENT_KEY` is set correctly
2. Check browser console for JavaScript errors
3. Check Vercel function logs for errors
4. Verify network tab shows POST requests to `/api/inngest`

---

## 📸 Visual Guide

### Finding Environment Variables in Vercel
```
Vercel Dashboard
└── Your Project (v0-cracker)
    └── Settings (tab at top)
        └── Environment Variables (left sidebar)
            └── Add New (button)
```

### What It Should Look Like When Done
```
Environment Variables

INNGEST_EVENT_KEY
Production, Preview, Development
eoqsTJrYiljDXrkQw6IZKdq7d9980aDn... (Edit) (Delete)

INNGEST_SIGNING_KEY
Production, Preview, Development
signkey-prod-50f567a261bc3a358... (Edit) (Delete)

NEXT_PUBLIC_SUPABASE_URL
Production, Preview, Development
https://your-project.supabase.co (Edit) (Delete)

[... other variables ...]
```

---

## ⚡ Quick Verification Commands

### Check if variables are set (after deployment)
Visit your app and check browser console:
```javascript
// This will be undefined (correct - server-side only)
console.log(process.env.INNGEST_EVENT_KEY) // undefined

// To verify they're working, trigger a document upload
// and check Inngest dashboard for events
```

### Check Vercel deployment logs
```bash
vercel logs [deployment-url]
```

Look for:
```
[Inngest] Event sent: document/uploaded
```

---

## ✅ Completion Checklist

- [ ] Opened Vercel dashboard for v0-cracker project
- [ ] Navigated to Settings → Environment Variables
- [ ] Added `INNGEST_EVENT_KEY` with correct value
- [ ] Added `INNGEST_SIGNING_KEY` with correct value
- [ ] Selected all three environments for both variables
- [ ] Clicked "Save" for both variables
- [ ] Redeployed the application
- [ ] Verified functions appear in Inngest dashboard
- [ ] Tested by uploading a document
- [ ] Confirmed events appear in Inngest Events tab

---

## 🎯 Expected Result

After completing these steps:

✅ **Local Development:** Inngest jobs work when running `npm run dev`
✅ **Vercel Production:** Inngest jobs work on your deployed app
✅ **Inngest Dashboard:** Shows 13 registered functions
✅ **Event Processing:** Documents upload and process in background
✅ **No Timeouts:** Long-running AI analysis completes successfully

---

## 📞 Need Help?

If you encounter issues:

1. **Check Vercel Logs:** Go to Deployments → Click deployment → View Function Logs
2. **Check Inngest Logs:** https://app.inngest.com/ → Events tab
3. **Verify Keys:** Ensure no typos or extra spaces in the keys
4. **Restart Services:** Redeploy Vercel, refresh Inngest dashboard

---

**Status:** Ready to deploy to Vercel ✅
**Time Required:** ~5 minutes
**Difficulty:** Easy (copy-paste)
