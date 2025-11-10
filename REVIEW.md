# PR Review: Workflow Refactoring - Next.js 16 Upgrade & DevKit Compliance

## Summary
The proposed PR claims to upgrade the app to Next.js 16 and bring it in line with the Workflow DevKit. However, the current state of the branch does not reflect those headline changes. The project is still pinned to Next.js 14 and the Workflow DevKit integration has effectively been removed. Below are the key blocking issues I found while reviewing the code.

## Major Issues

### 1. Next.js 16 upgrade never actually happens
The branch continues to depend on Next.js 14.0.4 in both `package.json` and the lockfile. This means the advertised upgrade never ships, so none of the Next.js 16 runtime, router, or config changes are being exercised. Any testing performed against this branch is still running on the old major version.

*Evidence:*
- `package.json` lists `"next": "14.0.4"` rather than a 16.x range.
- `package-lock.json` also resolves `next` to `14.0.4`.

**Impact:** Shipping this as-is would leave the team on the old framework version while the changelog and PR title suggest otherwise. Future debugging could be very confusing, and any compatibility fixes expected for Next.js 16 will still be outstanding.

### 2. Workflow DevKit compliance is regressed, not improved
The integration helper from the Workflow DevKit has been removed from `next.config.js` with a comment explaining that the package was uninstalled due to beta issues. None of the code reintroduces an alternative durable workflow runner. The exported workflow modules still use `'use workflow'` / `'use step'` directives, but without the DevKit runtime they execute like plain async functions—losing the durability, resume, and retry guarantees that DevKit is supposed to provide.

*Evidence:*
- `next.config.js` comments out the `withWorkflow` wrapper and notes the package has been removed.
- `package.json` no longer declares a dependency on the Workflow DevKit package, so the directives inside `lib/workflows/*.ts` cannot be hooked up to the runtime.

**Impact:** Background jobs will now run best-effort only. If the process crashes or the function throws midway through, there is no automatic retry or checkpointing. That is a regression from the stated goal of “DevKit compliance.”

## Recommendation
Block this PR until it either actually upgrades to Next.js 16 and reinstates a supported workflow runner, or the title/description are adjusted to reflect the real changes. At minimum, we should:
1. Bump `next` (and peer dependencies such as `react`, `eslint-config-next`, etc.) to the intended 16.x versions and verify the app builds and passes the existing test/lint suite on that major.
2. Restore a durable background execution mechanism—either by resolving the DevKit issues called out in the comments or by selecting another queue/worker implementation that offers retries and persistence.

Without those fixes, this PR misrepresents its impact and weakens the background processing guarantees the platform relies on.
