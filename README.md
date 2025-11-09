# FreshEyes Intelligence Platform

An AI-powered investigative intelligence platform for modern casework.

## ⚠️ IMPORTANT: Setup Required

**The application will not work without proper configuration.**

If you're seeing 404 or 500 errors, read [CRITICAL_SETUP_REQUIRED.md](./CRITICAL_SETUP_REQUIRED.md) immediately.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual API keys:
- Supabase URL and keys (required)
- Anthropic API key (required)
- Inngest event key and signing key (required for timeline analysis)
- OpenAI API key (optional)

**Check your configuration:** Visit `/api/health` after starting the server to see if all dependencies are configured.

See [.env.example](./.env.example) for details.

### 3. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000

## Required Services

### Core Requirements (App won't work without these)
- **Supabase**: Database and storage
- **Anthropic API**: AI-powered analysis
- **Inngest**: Background job processing for timeline analysis, deep analysis, and document processing

### Optional Services
- **OpenAI**: Embeddings and additional AI features (not required)

## Documentation

- [Critical Setup Guide](./CRITICAL_SETUP_REQUIRED.md) - Start here if you have errors
- [Environment Variables](./.env.example) - Configuration reference
- [Testing Checklist](./TESTING_CHECKLIST.md) - Feature testing guide

## Features

- AI-powered case analysis
- Document upload and processing
- Timeline reconstruction
- Investigation board
- Semantic search
- Victim timeline analysis

## Troubleshooting

**Check your configuration first:**
```bash
# Visit this endpoint after starting the server
curl http://localhost:3000/api/health
# Or visit in browser: http://localhost:3000/api/health
```

**Timeline analysis stuck at 0% progress?**
- You need to configure Inngest (see `.env.example`)
- Sign up at https://app.inngest.com (free)
- Add INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY to your environment variables

**Getting 404 errors for logo?**
- Fixed: Logo is now in `public/fresh-eyes-logo.png`

**Getting 500 errors on API endpoints?**
- You need to configure `.env.local` with your Supabase and API keys
- See [CRITICAL_SETUP_REQUIRED.md](./CRITICAL_SETUP_REQUIRED.md)
