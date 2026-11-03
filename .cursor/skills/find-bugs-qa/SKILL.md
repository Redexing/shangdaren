---
name: find-bugs-qa
description: >-
  Play watched three-bot Shangdaren games in the browser and report rule
  violations against docs/game.md. Invoke only with /find-bugs-qa.
disable-model-invocation: true
---

# Find bugs by watching bot games

Run this skill only when the user explicitly invokes `/find-bugs-qa`. Do not start it because a message mentions bugs, QA, rules, screenshots, or the game.

The deliverable is one report. Do not open a GitHub issue or a pull request unless the same invocation asks for that.

## How many games

Play **100** games unless the invoking message states a positive integer as the number of games to play. Use that integer. Ignore ports, years, rule numbers, and other figures that are not a game count.

## What counts as a bug

Read `docs/game.md` before the first game. Section 5 is the rule index. Sections 2–4 define the deck, piles, melds, and points those rules use.

A bug is a finished or stuck table whose board or browser console contradicts one named `[RULE-...]` id in section 5. Quote that id. If no id fits, the game is bug-free. Timing changes, speech bubbles, voice, layout, and uncertain readings are not bugs.

`how-to.html`, `about.html`, and `docs/archived/` are not the spec when they disagree with `docs/game.md`.

## Speed up the watched game

Watched games step on `GAME_SPEEDS` in `src/js/constants.js`. The production values (about 0.5–3 seconds) make a 100-game run too slow to watch.

- If the invoking message names a branch, check out that branch and use its constants. Do not switch away when you finish.
- If `src/js/constants.js` is already modified, keep that edit. Treat it as the speedup the user prepared.
- Otherwise set every `GAME_SPEEDS` value to `40`. Leave `UI_DELAYS` unchanged. Do not edit `rules.js`, `game.js`, or `docs/game.md` to go faster. Do not commit the timing edit. After the report is written, restore `src/js/constants.js` with `git checkout -- src/js/constants.js` when you were the one who changed it.

Keep every delay greater than 0. A zero delay can reorder the turn timers.

`sw.js` is cache-first and caches `src/js/constants.js`. Before the batch, in the page:

1. Unregister every service worker.
2. Delete every Cache Storage entry.
3. Reload.

Confirm the next draw follows `Game started` in well under a second. If the table still waits on the production delays, stop. A run against the cached slow script is invalid.

## Play each game in the browser

Use the session's browser tools. Do not replace this with `npm test` or a Node simulation. If no browser tool is available, stop and say so. Do not invent a report.

1. Serve this checkout over HTTP. `file://` cannot load the modules. Prefer `http://127.0.0.1:8000/` from `python3 -m http.server 8000 --bind 0.0.0.0` when that port is this checkout.
2. Open the game at a viewport **wider than 800px** (1280×900 is enough). At 800px and below the page becomes a carousel and two seats are off screen.
3. Set `#lang-select` to `en`, then `#sound-select` to `none`. English labels match the spec. Silence keeps voice playback out of the way.
4. Record the wall-clock start time in UTC.

For each game:

1. Mark the console so this hand is separable from the previous one.
2. Click `#btn-watch` (Watch Bot Game). Do not click `#btn-new-game`. Watch mode deals three bots and shows every HAND face up.
3. Wait until the page reaches an ending or gives up. An ending is a blocking alert, or a console line containing one of:
   - `declares HARMONY`
   - `is BAO-ZI`
   - `Deck empty. Draw game.`
   `main.js` calls `alert` on game over. The alert text is `Game Over! Winner: ...` or `Game Over! ... is BAO-ZI (no cards to discard). Everyone else wins!` A draw says `Game Over! Winner: None`.
4. If three minutes pass with no new console line, or five minutes pass with no ending, the hand is stuck. Capture it, then go on. The next `#btn-watch` starts a fresh game and cancels the old timers.
5. Write down the alert text and dismiss the alert. The board underneath is the final table. Screenshot it before the next Watch click, which replaces it. Capture `#players-area` and `#dashboard` together. If one image cannot fit the table, capture the whole page in parts and keep that set as the one board for this game.
6. Save the console slice from this hand's `[DECK] Initializing with seed:` through the terminal line. `game.log` prints each line once, and `main.js` prints it again with a `[GAME]` prefix. Keep one copy. Also keep any `console.error` from this hand.

Each seat shows HAND, EXPOSED (with a meld label), DISCARD, PASSED, card count, and points. Points are a clue. The rule text decides whether the score is legal.

## Judge, then cluster

Judge from the saved board and the console slice. A game with at least one named rule violation counts as **with bugs**, even if it never reached HARMONY, BAO-ZI, or an empty deck. A game that ends one of those three ways with no violation is **bug-free**. A game that neither ends nor supports a named rule is **incomplete**.

One game can violate more than one rule. Count the game once in "with bugs". It may contribute one candidate to each matching cluster.

Cluster by rule id. The cluster size is how many games violated that rule. Show **at most 3 samples** in the report. Three is the cap, not a target. Choose the three whose seed, board, and log lines make the contradiction easiest to check.

You may screenshot every buggy game while it is on screen. Before writing the report, delete every image and log excerpt that was not chosen. A game chosen for any of its clusters stays, and that same board may appear in each cluster that selected it. The report and `qa-runs/` must not contain a fourth sample for any rule.

Each sample has:

- the game index and the deck seed
- one sentence on what the rule requires and what this table did
- the final board screenshot (or the part-set for that one board)
- the relevant console lines: the seed line, the lines that show the bad action, and the terminal line when there is one

If the contradiction is only on the board, say that and still quote the seed line and the terminal line.

## Report

Write `qa-runs/<UTC-timestamp>/report.md` and put the sample images in that same folder. Follow `references/report-template.md`. Do not commit `qa-runs/`.

Show the same report in the reply, with the sample images. Required counts:

- games requested
- games played
- bug-free
- with bugs
- incomplete

Played must equal bug-free + with bugs + incomplete. Play every requested game unless the browser cannot continue. If you stop early, say why and set played to the number you finished.

Include a **Run meta** section. Record UTC start, UTC end, and wall time. Include token usage only when this runtime exposes a total. When it does not, write `not exposed by this runtime`. Never estimate a token count.
