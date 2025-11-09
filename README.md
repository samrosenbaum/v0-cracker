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
- Supabase URL and keys
- Anthropic API key
- (Optional) OpenAI and Inngest keys

See [.env.example](./.env.example) for details.

### 3. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000

### 4. Enable Document Processing (Required for file uploads)

**For document processing to work**, you must also run the Inngest Dev Server:

```bash
# In a separate terminal
npm run dev:inngest
```

This enables background job processing for:
- Document chunking and extraction
- Progress tracking
- AI analysis jobs

See [INNGEST_SETUP.md](./INNGEST_SETUP.md) for details.

**Without Inngest running, document upload jobs will be stuck at 0% forever.**

## Required Services

- **Supabase**: Database and storage
- **Anthropic API**: AI-powered analysis
- **OpenAI** (optional): Embeddings and additional AI features
- **Inngest** (optional): Background job processing

## Documentation

- [Critical Setup Guide](./CRITICAL_SETUP_REQUIRED.md) - Start here if you have errors
- [Inngest Setup Guide](./INNGEST_SETUP.md) - Fix document processing stuck at 0%
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

**Document processing jobs stuck at 0%?**
- You need to run the Inngest Dev Server: `npm run dev:inngest`
- See [INNGEST_SETUP.md](./INNGEST_SETUP.md)

**Getting 404 errors for logo?**
- Fixed: Logo is now in `public/fresh-eyes-logo.png`

**Getting 500 errors on API endpoints?**
- You need to configure `.env.local` with your Supabase and API keys
- See [CRITICAL_SETUP_REQUIRED.md](./CRITICAL_SETUP_REQUIRED.md)
