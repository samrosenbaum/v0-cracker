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

module.exports = withWorkflow(nextConfig)