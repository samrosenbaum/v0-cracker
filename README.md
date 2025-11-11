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

## Required Services

- **Supabase**: Database and storage
- **Anthropic API**: AI-powered analysis
- **OpenAI** (optional): Embeddings and additional AI features
- **Inngest** (optional): Background job processing

## Documentation

- [Critical Setup Guide](./CRITICAL_SETUP_REQUIRED.md) - Start here if you have errors
- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md) - **MUST READ for Vercel deployments**
- [Environment Variables](./.env.example) - Configuration reference
- [Testing Checklist](./TESTING_CHECKLIST.md) - Feature testing guide

## Features

- AI-powered case analysis
- Document upload and processing
- Timeline reconstruction
- Investigation board
- Semantic search
- Victim timeline analysis

## Deploying to Vercel

**⚠️ CRITICAL: AI analysis features will NOT work without Fluid Compute enabled.**

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for:
- How to enable Fluid Compute (required for background workflows)
- Environment variable setup
- Troubleshooting deployment issues

## Troubleshooting

**AI analysis not working / jobs stuck in "pending"?**
- **On Vercel:** You must enable Fluid Compute in project settings
- See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for complete guide

**Getting 404 errors for logo?**
- Fixed: Logo is now in `public/fresh-eyes-logo.png`

**Getting 500 errors on API endpoints?**
- You need to configure `.env.local` with your Supabase and API keys
- See [CRITICAL_SETUP_REQUIRED.md](./CRITICAL_SETUP_REQUIRED.md)
