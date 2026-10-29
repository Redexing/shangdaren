---
description: Repository workflow conventions for issues and pull requests
globs: "**/*"
alwaysApply: true
---

# Workflow Guidelines

- When a pull request fully fixes an issue, include GitHub’s closing syntax in the PR description, such as `Fixes #123`, so GitHub automatically closes the issue when the PR merges. Use `Closes` or `Resolves` only when they more accurately describe the relationship; do not use a closing keyword for partial fixes.
