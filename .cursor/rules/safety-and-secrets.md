---
description: Guardrails for git operations, branch safety, and secret protection
globs: "**/*"
alwaysApply: true
---
# Security & Operational Safeguards

- **Never Leak Secrets:** 
  Do not log, echo, or output raw values from `.env`, secret managers, or token configs in console logs or responses.

- **Protected Branch Guard (No Direct Pushes):**
  - Direct `git push` to `main`, `master`, `release`, `staging`, or `production` is STRICTLY PROHIBITED.
  - Never execute `git merge` directly into `main` or default production branches locally.
  - Never run destructive git commands (`git push --force`, `git reset --hard`, `git rebase` on remote branches) without explicit user consent.

- **Feature Branch Workflows (Allowed Operations):**
  - **Creating Branches:** You are permitted to create and switch to feature branches (e.g., `feature/*`, `fix/*`, `agent/*`).
  - **Commits & Pushes:** You are permitted to run `git commit` and `git push -u origin <branch-name>` ON FEATURE BRANCHES ONLY.
  - **Pull Requests:** You are encouraged to use `gh pr create` to open a Pull Request once tests pass on your feature branch.

- **Human Review Requirement:**
  - Merging PRs into protected branches MUST be executed by human approval via GitHub/GitLab PR UI or explicitly instructed by the user after code review.
