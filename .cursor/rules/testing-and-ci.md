---
description: Automated test verification and build checks
globs: "**/*"
alwaysApply: true
---
# Test & Quality Execution Guardrails

- **Self-Verification:** Before reporting a task complete or issuing a git commit/PR, you MUST run the local test suite and linter.
- **Commands to Run:**
  - Linter: `npm run lint` (or `pytest` / `golangci-lint` depending on environment)
  - Tests: `npm test`
- **Bug Fixes (Test-First Principle):** When fixing bugs, adopt the test-first principle: add a test case when possible to demonstrate the issue first, then fix the code to make the test pass. This ensures convergence on expected game behavior and prevents regressions.
- **Error Handling:** If tests or linting checks fail:
  1. Do NOT ask the user to fix it manually unless credentials or external APIs are missing.
  2. Inspect the stack trace, fix the issue in code, and re-run the check.
  3. You are permitted up to 3 repair iterations. If still failing after 3 attempts, revert changes and leave a detailed diagnosis.

