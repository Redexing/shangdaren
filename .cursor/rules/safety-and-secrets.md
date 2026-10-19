---
description: Guardrails for git operations, branch safety, GitHub PR guidelines, and secret protection
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

- **Human Review Requirement:**
  - Merging PRs into protected branches MUST be executed by human approval via GitHub/GitLab PR UI or explicitly instructed by the user after code review.

# Git & GitHub PR Guidelines

- **Branching:** Always ensure work is on a non-main feature branch (`feature/*`, `fix/*`, or `agent/*`).
- **Pushing & PRs:** You are authorized to run `git commit` and `git push -u origin <branch>` on feature branches and use the GitHub CLI (`gh pr create`) once tests pass.
- **PR Format:** Use `gh pr create --fill` or specify `--title` and `--body` explicitly based on the commit summary.
