// Workflow DevKit Integration
// Requires extensive refactoring to wrap all Node.js module usage in step functions
// The workflow code in lib/workflows/ works as regular async functions for now
//
// To enable when refactored:
// 1. npm install workflow@latest --legacy-peer-deps
// 2. Uncomment: const { withWorkflow } = require('workflow/next');
// 3. Replace module.exports line with: module.exports = withWorkflow(nextConfig)
// 4. Wrap all Supabase/OpenAI/Node.js calls in step.run()
//
// const { withWorkflow } = require('workflow/next');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  turbopack: {
    // Empty config to acknowledge Turbopack usage and silence migration warnings
  },
  webpack: (config, { isServer }) => {
    // Fix canvas dependency issues during build
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('canvas');
    }
    return config;
  },
}

// STANDARD CONFIG (Workflow DevKit disabled - requires refactoring)
// The workflow functions in lib/workflows/ execute as regular async functions
module.exports = nextConfig