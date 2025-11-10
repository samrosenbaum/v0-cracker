// Workflow DevKit Integration
// TEMPORARILY DISABLED: Workflow DevKit v4.0.1-beta.12 has a webpack loader bug
// that prevents production builds from succeeding. The workflow code is ready
// and will work once Workflow DevKit releases a stable version.
//
// To re-enable when stable version is available:
// 1. Uncomment the line below
// 2. Uncomment module.exports = withWorkflow(nextConfig)
// 3. Comment out module.exports = nextConfig
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
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
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

// TEMPORARILY USING STANDARD CONFIG
// The workflow functions in lib/workflows/ are ready to use, they just won't
// have automatic durability/retries until Workflow DevKit is stable.
// Workflows will still execute, just without the resilience features.
module.exports = nextConfig

// When Workflow DevKit stable version is available, replace above line with:
// module.exports = withWorkflow(nextConfig)