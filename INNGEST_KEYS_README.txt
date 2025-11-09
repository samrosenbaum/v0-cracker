================================================================================
INNGEST KEYS - QUICK REFERENCE
================================================================================

YOUR INNGEST KEYS (Copy-paste ready for Vercel):

Event Key:
eoqsTJrYiljDXrkQw6IZKdq7d9980aDnzMwtC8IQwr3KAEJdeB49t3P1KXLW0jlxKfHdSGYPF3PiWvb9kXVU4Q

Signing Key:
signkey-prod-50f567a261bc3a3588aa3d29fe67a2904ebdc1376758a898b372f39b290eb434

================================================================================
WHERE THESE KEYS ARE ALREADY CONFIGURED
================================================================================

✅ LOCAL DEVELOPMENT (.env.local)
   Location: /home/user/v0-cracker/.env.local
   Status: Keys added and ready to use
   Usage: Run 'npm run dev' and Inngest will work automatically

✅ CODE INTEGRATION (lib/inngest-client.ts)
   Status: Already configured to read from environment variables
   Usage: No code changes needed - it just works!

✅ WEBHOOK ENDPOINT (app/api/inngest/route.ts)
   Status: Fully implemented with 15 job functions
   URL: /api/inngest
   Usage: Inngest automatically calls this endpoint

================================================================================
WHAT YOU NEED TO DO NEXT
================================================================================

⚠️ STEP 1: ADD KEYS TO VERCEL (REQUIRED FOR PRODUCTION)

1. Go to: https://vercel.com/[your-username]/v0-cracker/settings/environment-variables

2. Click "Add New Variable" and add:

   Key:   INNGEST_EVENT_KEY
   Value: eoqsTJrYiljDXrkQw6IZKdq7d9980aDnzMwtC8IQwr3KAEJdeB49t3P1KXLW0jlxKfHdSGYPF3PiWvb9kXVU4Q
   Envs:  ✅ Production ✅ Preview ✅ Development

3. Click "Add New Variable" again and add:

   Key:   INNGEST_SIGNING_KEY
   Value: signkey-prod-50f567a261bc3a3588aa3d29fe67a2904ebdc1376758a898b372f39b290eb434
   Envs:  ✅ Production ✅ Preview ✅ Development

4. Click "Save" for both

5. REDEPLOY your app:
   - Go to Deployments tab
   - Click latest deployment → "..." → "Redeploy"
   - OR push a new commit

⚠️ STEP 2: COMPLETE OTHER REQUIRED SETUP

You still need to configure:

1. SUPABASE (Required)
   - Create project: https://app.supabase.com
   - Run database migrations (4 SQL files in repo root)
   - Add 3 Supabase keys to Vercel and .env.local

2. ANTHROPIC API (Required)
   - Get API key: https://console.anthropic.com/settings/keys
   - Add to Vercel and .env.local as ANTHROPIC_API_KEY

3. OPENAI API (Optional)
   - Get API key: https://platform.openai.com/api-keys
   - Add to Vercel and .env.local as OPENAI_API_KEY

================================================================================
FILES CREATED FOR YOU
================================================================================

1. .env.local
   - Local environment variables with Inngest keys
   - Also has placeholders for Supabase and Anthropic keys
   - Add your remaining API keys here

2. INNGEST_SETUP_COMPLETE.md
   - Comprehensive guide to Inngest configuration
   - Explains how everything works
   - Troubleshooting tips

3. VERCEL_INNGEST_DEPLOYMENT.md
   - Step-by-step Vercel deployment guide
   - Copy-paste instructions
   - Visual walkthrough

4. INNGEST_KEYS_README.txt (this file)
   - Quick reference for your keys
   - Next steps checklist

================================================================================
WHAT INNGEST DOES IN YOUR APP
================================================================================

Inngest processes these background jobs:

📄 Document Processing (4 jobs)
   - Chunk large documents
   - Extract text from PDFs
   - Generate embeddings
   - Aggregate processed data

📊 Investigation Board (1 job)
   - Auto-populate evidence boards
   - Extract entities from documents

🔍 AI Analysis (10 jobs)
   - Timeline reconstruction
   - Deep comprehensive analysis
   - Victim timeline tracking
   - Behavioral pattern analysis
   - Evidence gap detection
   - Relationship network mapping
   - Similar cases finder
   - Overlooked details detection
   - Interrogation question generation
   - Forensic retesting recommendations

Without Inngest, these jobs would timeout. With Inngest, they run in the background!

================================================================================
TESTING INNGEST LOCALLY
================================================================================

1. Make sure .env.local exists (it does - we created it!)

2. Start dev server:
   npm run dev

3. Upload a document to a case

4. Check terminal for:
   [Inngest] Event sent: document/uploaded
   [Inngest] Processing job: chunk-document-xyz

5. Check Inngest dashboard:
   https://app.inngest.com/
   → Events tab should show your event

================================================================================
SECURITY NOTES
================================================================================

⚠️  NEVER commit .env.local to git (already in .gitignore ✅)
⚠️  NEVER share these keys publicly
⚠️  These are PRODUCTION keys - keep them secret
⚠️  If compromised, rotate keys at https://app.inngest.com/

================================================================================
QUICK STATUS CHECK
================================================================================

✅ Inngest keys obtained
✅ .env.local created with keys
✅ Code already configured to use keys
✅ Documentation created
⚠️ Need to add keys to Vercel
⚠️ Need to setup Supabase
⚠️ Need to setup Anthropic API
⚠️ Need to run database migrations

================================================================================
HELP & DOCUMENTATION
================================================================================

Full setup guide:        INNGEST_SETUP_COMPLETE.md
Vercel deployment:       VERCEL_INNGEST_DEPLOYMENT.md
Supabase setup:          SUPABASE_DATABASE_SETUP.md
Environment variables:   .env.example
Main README:             README.md

Inngest dashboard:       https://app.inngest.com/
Inngest docs:            https://www.inngest.com/docs

================================================================================
