# Auto-publish to GitHub Pages

## Goal

Ship `main` to https://redexing.github.io/shangdaren/ on a schedule, or when `main` has changes the live site does not. A Cursor agent prepares the publication. A person merges it.

## How the site is published today

GitHub Pages for `Redexing/shangdaren` is a legacy site. Its source is the `release` branch at `/`. There is no build. Updating `release` is the deploy: Pages rebuilds from that branch and serves it at `https://redexing.github.io/shangdaren/`.

`main` is the development branch. As of 2026-10-29 it is 38 commits ahead of `release`. The live service worker cache is `shangdaren-v1`. `main` is `shangdaren-v17`. The first publish PR will move the public game from that older snapshot to current `main`.

Agents do not push `main` or `release`. `.cursor/rules/safety-and-secrets.md` requires a person to merge into those branches. This procedure stops at an open pull request.

## What the agent publishes

A branch based on `origin/release` with one commit. That commit's tree is only the allowlist below, copied from `origin/main`. Merging the pull request into `release` updates Pages. The live site matches those files at the `main` commit named in the pull request, and nothing else.

`test/`, `docs/`, `.cursor/`, `AGENTS.md`, other `.md` files, `package.json`, and `tools/` stay on `main`. They are not on the allowlist, so they are not published.

### Allowlist

```text
LICENSE
README.md
index.html
about.html
how-to.html
versions.html
manifest.json
sw.js
icon-192.png
icon-512.png
src/css/style.css
src/js/card.js
src/js/constants.js
src/js/deck.js
src/js/game.js
src/js/main.js
src/js/player.js
src/js/rules.js
src/js/translations.js
src/js/utils.js
```

This list is the PWA: the pages, manifest, icons, service worker, and the scripts and stylesheet those pages load, plus `LICENSE` and `README.md`. Publish commands read this block from `origin/main`. When the block changes, those commands pick up the new set after the change merges. Do not keep a second copy.

```bash
allow=$(git show origin/main:docs/plans/auto-publish.md | sed -n '/^```text$/,/^```$/p' | sed '1d;$d' | sed '/^$/d')
```

### Allowlist review

Run this before any publish. `main` may gain a script or an `.html` page, or lose one, without this block changing in the same commit.

Candidates on `origin/main` are:

- `LICENSE` and `README.md`
- `manifest.json`, `sw.js`, and root `icon-*.png`
- every root `*.html`
- every file under `src/`

Everything else stays off the list, including `test/`, `docs/`, `.cursor/`, `AGENTS.md`, `package.json`, and `tools/`.

Compare the candidates with `allow`:

1. **Add.** A candidate is missing from `allow`, and a file already on `allow` or in `ASSETS_TO_CACHE` references it (`import`, `src`, `href`, `url(`, or a cache path). Follow references through other candidates until no new file appears. A root `.html` linked from `index.html` or another allowlisted page is added the same way. Open a pull request to `main` that adds those paths to this block. In that same pull request, add each new site file except `LICENSE` and `README.md` to `ASSETS_TO_CACHE` and bump `CACHE_NAME`.
2. **Remove.** A path is on `allow` but absent from `origin/main`. It is obsolete. Open a pull request to `main` that deletes it from this block, deletes it from `ASSETS_TO_CACHE` if it is listed there, and bumps `CACHE_NAME` when `sw.js` changes.
3. **Ask.** A candidate is not referenced by step 1. List it and ask whether it belongs in the PWA. Leave it off the allowlist until the user says to add it. Do not publish while that question is open.
4. **Ask before dropping a live file.** A path is on `allow` and still on `origin/main`, but nothing references it, and it is not `LICENSE`, `README.md`, `index.html`, `manifest.json`, or `sw.js`. Ask whether to remove it. Those five paths stay while they exist.

When step 1 or 2 applies, stop after opening the `main` pull request. Publish on a later run, once that pull request is merged and `allow` matches the candidates. Do not publish a partial tree and do not invent paths.

## When to run

Use one of these prompts. Each prompt follows this document and `docs/plans/publish-schedule.md`.

| Prompt | When it publishes |
| --- | --- |
| `Publish if due` | `mode` is `schedule`, `hold` is false, local time is at or after `next_publish`, and there are shippable allowlist changes. This is the scheduled run. |
| `Publish unreleased main` | `hold` is false and there are shippable allowlist changes. The clock is ignored for this run. |
| `Publish now` | There are shippable allowlist changes. The clock and `hold` are ignored. Tests and the cache check still apply. |

A Cursor Automation can send `Publish if due` on a cron a few minutes after the schedule (Sunday 18:05 America/Los_Angeles). A second automation, or a person after merging feature work, can send `Publish unreleased main`. Leave `mode: schedule` in the schedule file until a standing on-change run is wanted.

Do not add a GitHub Action that pushes `release`. Pages already rebuilds when `release` changes, and an Action push would skip human review.

## Shippable changes

```bash
git fetch origin main release
allow=$(git show origin/main:docs/plans/auto-publish.md | sed -n '/^```text$/,/^```$/p' | sed '1d;$d' | sed '/^$/d')
git diff --stat origin/release origin/main -- $allow
```

A non-empty diff is shippable. Changes to tests, docs, agent rules, or `docs/plans/publish-schedule.md` do not publish the site.

If the diff is empty, `release` already matches the allowlisted files on `main`. Report that and go to [After the site is already current](#after-the-site-is-already-current).

## Steps

1. Read `docs/plans/publish-schedule.md` and choose the row in [When to run](#when-to-run).
2. If this run should not publish, stop and report `mode`, `hold`, `next_publish`, and whether shippable allowlist changes exist. Do not open a pull request.
3. If a pull request into `release` is already open, reply with its URL and stop. Do not open a second one and do not force-push the existing publish branch.
4. Run `npm test` on current `origin/main`. If it fails, stop. Do not publish.
5. Run [Allowlist review](#allowlist-review). Continue only when every candidate is either on `allow` or explicitly left off, and every `allow` path exists on `origin/main`.
6. Run the cache check below. If it fails, stop. Do not publish.
7. Build a publish branch from `origin/release` whose tree is exactly `allow` at `origin/main`. Do not `git add -A`; untracked files in the worktree must stay unstaged:

```bash
stamp=$(TZ=America/Los_Angeles date +%Y-%m-%d-%H%M)
sha=$(git rev-parse --short origin/main)
git checkout -b "publish/$stamp" origin/release
git rm -rf .
allow=$(git show origin/main:docs/plans/auto-publish.md | sed -n '/^```text$/,/^```$/p' | sed '1d;$d' | sed '/^$/d')
git checkout origin/main -- $allow
```

8. `git ls-files` must match the allowlist exactly. If it does not, delete the local branch and stop. Do not push.
9. Commit, push, and open the pull request:

```bash
git commit -m "Publish $sha"
git push -u origin HEAD
gh pr create --base release --head "publish/$stamp" \
  --title "Publish main to the live site ($stamp)" \
  --body "$(cat <<EOF
## Summary
- Publishes the PWA files from \`origin/main\` ($sha) onto \`release\`, which GitHub Pages serves at https://redexing.github.io/shangdaren/.
- The tree is the allowlist in \`docs/plans/auto-publish.md\`: site files, \`LICENSE\`, and \`README.md\`. Tests, \`docs/\`, and agent rules are not included.
- Service worker cache: $(git show origin/release:sw.js | sed -n 's/.*CACHE_NAME = //p') → $(git show origin/main:sw.js | sed -n 's/.*CACHE_NAME = //p').
- \`npm test\` passed on \`origin/main\`.

## Test plan
- [ ] The pull request file list matches the allowlist and contains no \`test/\`, \`docs/\`, or \`.cursor/\` paths.
- [ ] Merge this pull request into \`release\`.
- [ ] Confirm Pages status is \`built\`.
- [ ] Confirm https://redexing.github.io/shangdaren/sw.js shows the new \`CACHE_NAME\`.
EOF
)"
```

10. Reply with the pull request URL and stop. Leave merging to the person who reviews it.

The branch name includes the time so a later publish does not need a force-push. Close an older open publish pull request only when the user asks to replace it; then cut a new branch.

## Cache check

The service worker is cache-first. Players keep the previous game until `CACHE_NAME` in `sw.js` changes.

```bash
allow=$(git show origin/main:docs/plans/auto-publish.md | sed -n '/^```text$/,/^```$/p' | sed '1d;$d' | sed '/^$/d')
cached=$(printf '%s\n' $allow | grep -vxE 'LICENSE|README.md')
git diff --name-only origin/release origin/main -- $cached
```

`LICENSE` and `README.md` are published, and they are not part of the service-worker cache.

- If that list is empty, the cache check passes.
- If that list is non-empty, `CACHE_NAME` on `origin/main` must differ from `CACHE_NAME` on `origin/release`. If they are the same, stop and ask for a normal `main` pull request that bumps `CACHE_NAME` and lists any new file in `ASSETS_TO_CACHE`. Publish after that pull request merges.

## After the person merges

Run this only after the publish pull request is merged:

```bash
gh api repos/Redexing/shangdaren/pages --jq .status
curl -fsS https://redexing.github.io/shangdaren/sw.js | head -n 5
```

Wait until Pages reports `built`, then confirm the live `CACHE_NAME` matches the merged snapshot. This is a file fetch, not a browser session.

Then open the bookkeeping pull request in [Move the next publish time](#move-the-next-publish-time).

## After the site is already current

If there is nothing shippable and a `Publish if due` run is past `next_publish`, the date is stale. Open the bookkeeping pull request so the next scheduled run waits for the following slot.

If a `Publish unreleased main` run finds nothing shippable, report that and do not change the schedule.

## Move the next publish time

On a fresh branch from `origin/main`, edit only `docs/plans/publish-schedule.md`.

Set `next_publish` to the next weekly slot strictly after now: the next `weekday` at `time` in `timezone`. A publish on Sunday morning waits until the Sunday after, not 18:00 the same day.

Open a pull request into `main` titled `Schedule the next site publish`. Do not include game files. Merging it does not publish the site: `docs/plans/publish-schedule.md` is not on the allowlist.

`Publish now` and `Publish unreleased main` use the same next-slot rule when bookkeeping runs after a merge. They do not move the date before the publish pull request merges.
