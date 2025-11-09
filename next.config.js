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
  // Fix for pdfjs-dist using browser APIs (DOMMatrix) in server environment
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude pdfjs-dist from server bundle - it will be dynamically imported only when needed
      config.externals = config.externals || [];
      config.externals.push({
        'pdfjs-dist': 'commonjs pdfjs-dist',
        'pdfjs-dist/legacy/build/pdf.mjs': 'commonjs pdfjs-dist/legacy/build/pdf.mjs',
      });
    }

    // Ignore canvas module warnings (used by pdfjs but not needed in our use case)
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias.canvas = false;

    return config;
  },
}

module.exports = nextConfig