// Workflow DevKit Integration
// Enables 'use workflow' and 'use step' directives for durable background processing
const { withWorkflow } = require('workflow/next');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Enable experimental features for Next.js 15/16
  experimental: {
    // Enable unstable_after API for background task execution
    after: true,
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

// Export with Workflow DevKit wrapper for durable execution
module.exports = withWorkflow(nextConfig)