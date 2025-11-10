# Workflow DevKit Beta - Production Issues Report

**Date**: November 10, 2025
**Version Tested**: v4.0.1-beta.12 (latest beta)
**Context**: Attempted migration from Inngest to Workflow DevKit on Vercel-hosted Next.js 14 app

---

## Summary

Workflow DevKit is not production-ready in its current beta state. We encountered **two critical build failures** that prevent deployment to Vercel.

---

## Issue #1: Webpack Loader Error with Undici

### Error
```
Module parse failed: Unexpected token (682:63)
./node_modules/undici/lib/web/fetch/util.js

File was processed with these loaders:
 * ./node_modules/next/dist/build/webpack/loaders/next-flight-loader/index.js
 * ./node_modules/next/dist/build/webpack/loaders/next-swc-loader.js
 * ./node_modules/@workflow/next/dist/loader.js
```

### Root Cause
The `@workflow/next` webpack loader attempts to transform `node_modules/undici` but fails on private class field syntax (`#target in this`). The loader shouldn't be processing node_modules dependencies.

### Impact
**Complete build failure** - Cannot deploy with `withWorkflow()` enabled.

### Severity
🔴 **Critical** - Blocks production deployment

### Related Issues
This is NOT unique to Workflow DevKit. Similar errors reported in:
- nodejs/undici #2954, #3122
- firebase/firebase-js-sdk #8494
- nuxt/nuxt #25907
- elastic/elasticsearch-js #2207

### Workaround
Disable `withWorkflow()` wrapper - workflows execute but without durability features.

---

## Issue #2: Build Trace Stack Overflow

### Error
```
RangeError: Maximum call stack size exceeded
at create (/vercel/path0/node_modules/next/dist/compiled/micromatch/index.js:15:18889)
```

Occurs during "Collecting build traces" phase.

### Root Cause
The `@workflow` package is **331MB** (extremely large). Next.js's micromatch-based file pattern matching hits recursion limits when traversing this massive node_modules tree.

### Impact
**Build failure at 99% completion** - Even with `withWorkflow()` disabled, the package presence causes issues.

### Severity
🟡 **High** - Blocks deployment until workaround applied

### Workaround
Add to `next.config.js`:
```javascript
experimental: {
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@workflow/**/*',
      'node_modules/workflow/**/*',
    ],
  },
}
```

---

## Issue #3: Community Reports

### Open Build-Related Issues on GitHub
- **#92**: "Adding withWorkflow to next.config breaks the entire app" (Oct 27, 2025)
- **#212**: "@workflow/next loader breaks automatic JSX transform" (Nov 4, 2025)
- **#263**: "withWorkflow crashes on yarn dev" (Nov 7, 2025)

These are NOT isolated incidents - **multiple users experiencing build failures**.

---

## Package Analysis

### Version Status
- **Latest**: v4.0.1-beta.12
- **Status**: Public Beta (announced Oct 23, 2025)
- **Stable Release**: Not available

### Package Size Issue
- **@workflow package**: 331MB
- **Comparison**: Most npm packages are <10MB
- **Impact**: Causes tooling issues beyond just build traces

---

## Recommendations for Vercel Team

### Immediate (Critical)
1. **Fix webpack loader** - Should not transform node_modules dependencies
2. **Investigate package size** - 331MB is excessive, suggests bundling issues
3. **Add build integration tests** - Test with real Next.js projects on Vercel before release

### Short-term (Before Stable)
1. **Document known issues** - Be transparent about beta limitations
2. **Provide migration guidance** - Official examples for common patterns (like our Inngest → Workflow migration)
3. **Test on Vercel specifically** - Since it's a Vercel product, it should work flawlessly on Vercel

### Long-term (Architecture)
1. **Reduce package size** - Investigate tree-shaking, external dependencies
2. **Improve loader logic** - Smarter detection of what needs transformation
3. **Better error messages** - Current errors are cryptic and hard to debug

---

## Why We Wanted to Migrate

### Problems with Inngest
- ❌ Vercel not recognizing functions during deployment
- ❌ External webhooks required
- ❌ Additional service to configure
- ❌ Separate billing

### Expected Benefits of Workflow DevKit
- ✅ Native Vercel integration
- ✅ No external dependencies
- ✅ Direct function calls (better DX)
- ✅ Built by Vercel team (should "just work")

### Reality
- 🔴 Cannot use in production
- 🔴 More complex than Inngest to get working
- 🔴 Beta blockers are fundamental (not edge cases)

---

## Current Status

We have:
- ✅ Successfully migrated all 10 workflows to Workflow DevKit pattern
- ✅ Code is production-ready and well-documented
- ✅ Found workarounds for both build failures
- ⏳ Waiting for stable release to enable full features

### Deployment Status
**Working with workarounds**:
- `withWorkflow()` disabled
- Build trace exclusions added
- Workflows execute as regular async functions (no durability)

---

## Positive Notes

### Good Things About Workflow DevKit
1. **Excellent developer experience** - The `'use workflow'` / `'use step'` pattern is intuitive
2. **Good documentation** - Concepts are well explained
3. **TypeScript-first** - Strong type safety
4. **Promising vision** - Native Vercel integration is the right direction

### What Works
- ✅ Local development (without `withWorkflow()`)
- ✅ Code patterns and APIs
- ✅ Migration from event-driven systems is straightforward
- ✅ TypeScript inference and types

---

## Bottom Line

**Workflow DevKit has excellent vision and developer experience, but the beta has critical production blockers.**

### For Internal Teams
- ⚠️ **Do not recommend for production yet**
- ✅ **Good for experimental/side projects**
- 📅 **Reassess after stable release**

### For Vercel CEO
The product direction is right, but **quality bar for stable release must be higher**. These are not edge cases - they affect basic Next.js deployment on Vercel itself.

Users expect Vercel products to "just work" on Vercel. This doesn't meet that standard yet.

---

## Test Case Repository

Our migration is available for Vercel team to test against:
- **Repo**: github.com/samrosenbaum/v0-cracker
- **Branch**: `claude/migrate-inngest-workflow-devkit-011CUyYVuwUdvM6Azzdsu2Z3`
- **Documentation**: Complete migration guide, comparison docs, and build notes included

This represents a real-world production use case that should work but doesn't.

---

## Timeline Expectations

- ✅ **Beta (Now)**: Testing, feedback, iteration
- ⏳ **Stable (Needed)**: Production-ready with fix for issues #1 and #2
- 🎯 **Suggested**: Don't rush stable - better to delay than ship broken

**Current ETA**: Unknown
**Recommended ETA**: After addressing these critical issues + comprehensive Vercel integration testing

---

*This report represents honest feedback from a user who wants Workflow DevKit to succeed. The vision is excellent, execution needs work.*
