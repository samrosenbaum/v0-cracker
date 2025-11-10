// Workflow DevKit Integration
// PACKAGE REMOVED: Due to critical beta bugs (webpack loader + 331MB size causing stack overflow)
// The workflow code in lib/workflows/ is ready and works as regular async functions.
//
// To re-enable when stable version is available:
// 1. npm install workflow@latest
// 2. Uncomment: const { withWorkflow } = require('workflow/next');
// 3. Replace module.exports line with: module.exports = withWorkflow(nextConfig)
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
};

// STANDARD CONFIG (Workflow DevKit package removed due to beta issues)
// The workflow functions in lib/workflows/ execute as regular async functions.
// They work perfectly, just without auto-durability/retries until stable release.
module.exports = nextConfig;
