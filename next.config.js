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
    // Enable 'after' API for background task execution
    // In Next.js 16+, this is stable and the flag can be removed
    // With Fluid Compute enabled in Vercel, this allows workflows to run
    // in the background after HTTP responses complete
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

module.exports = nextConfig