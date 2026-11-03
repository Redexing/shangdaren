---
name: find-bugs-qa
description: >-
  Orchestrate watched three-bot Shangdaren games and report rule violations
  against docs/game.md. The main agent prepares each game and a subagent
  plays it. Invoke only with /find-bugs-qa.
disable-model-invocation: true
---

# Find bugs by watching bot games

Run this skill only when the user explicitly invokes `/find-bugs-qa`. Do not start it because a message mentions bugs, QA, rules, screenshots, or the game.

The deliverable is one report. Do not open a GitHub issue or a pull request unless the same invocation asks for that.

## Who does what

The agent that loaded this skill is the **main agent**. It prepares the run, sends one self-contained task per game, waits for every subagent, and writes the report. It does not play a hand and it does not judge a table from its own browser.

A **subagent** plays exactly one watched game, decides whether that table violates `docs/game.md`, and returns a finding. The procedure it must follow is `references/subagent-brief.md`. A subagent does not see this conversation, so the main agent puts the brief and the per-game fields in the task prompt.

Spawn each subagent in this same workspace so its screenshot and `finding.json` land in `qa-runs/`. One game per subagent. Do not send a second game to a subagent that is still playing, and do not resume a subagent onto another game while its browser still shows the previous table.

## How many games

Play **100** games unless the invoking message states a positive integer as the number of games to play. Use that integer. Ignore ports, years, rule numbers, and other figures that are not a game count.

## What counts as a bug

Read `docs/game.md` before dispatching. Section 5 is the rule index. Sections 2–4 define the deck, piles, melds, and points those rules use.

A bug is a finished or stuck table whose board or browser console contradicts one named `[RULE-...]` id in section 5. The subagent must quote that id. If no id fits, the game is bug-free. Timing changes, speech bubbles, voice, layout, and uncertain readings are not bugs.

`how-to.html`, `about.html`, and `docs/archived/` are not the spec when they disagree with `docs/game.md`.

## Prepare the run

Do this once, before any game subagent starts.

Watched games step on `GAME_SPEEDS` in `src/js/constants.js`. The production values (about 0.5–3 seconds) make a 100-game run too slow to watch.

- If the invoking message names a branch, check out that branch and use its constants. Do not switch away when you finish.
- If `src/js/constants.js` is already modified, keep that edit. Treat it as the speedup the user prepared.
- Otherwise set every `GAME_SPEEDS` value to `40`. Leave `UI_DELAYS` unchanged. Do not edit `rules.js`, `game.js`, or `docs/game.md` to go faster. Do not commit the timing edit. After the report is written, restore `src/js/constants.js` with `git checkout -- src/js/constants.js` when you were the one who changed it.

Keep every delay greater than 0. A zero delay can reorder the turn timers.

Serve this checkout over HTTP. `file://` cannot load the modules. Prefer `http://127.0.0.1:8000/` from `python3 -m http.server 8000 --bind 0.0.0.0` when that port is this checkout. Leave the server running until the report is written.

Create `qa-runs/<UTC-timestamp>/games/`. Record the wall-clock start in UTC after the browser check below, before game 1.

## Parallel or one at a time

Subagents may play at the same time only when each one has its own browser. A shared desktop or a single shared browser subagent is one session: the next Watch click would replace the table another game is using.

If you already know the runtime gives every subagent a separate browser, run the games concurrently. Fill only as many browsers as the runtime can keep open, and start another game when one of those browsers is free.

If you already know they share one browser, run one subagent to completion, wait for its finding, then send the next game. On a runtime with a single shared browser subagent, reuse that session for the next game only after its finding is back and the previous table is no longer needed.

When you are unsure, decide with a probe before game 1. Launch two subagents together. Give each `references/subagent-brief.md` and a different URL: `http://127.0.0.1:8000/?probe=A` and `http://127.0.0.1:8000/?probe=B`. Each one only opens that URL and returns the URL it actually loaded. Do not click Watch.

- Both return their own probe URL: browsers are independent. Play the batch concurrently, within the number of browsers the runtime can keep open.
- They return the same URL, one fails to open a page, or the runtime has only one browser subagent: play one game at a time.
- Neither can open a browser: stop. Do not invent a report, and do not replace the browser with `npm test` or a Node simulation.

Probe games do not count toward the requested number.

## Dispatch and wait

For each game index from 1 to the requested count, the task prompt contains:

- the path to `references/subagent-brief.md`, and the instruction to follow it for this one game
- the game index and the requested total
- the game URL (no probe query)
- the output directory `qa-runs/<UTC-timestamp>/games/<index>/`
- the same bug definition as above, including the path `docs/game.md`

Then wait. Every requested game needs a finding before you write the report. A subagent that fails without `finding.json` is an incomplete game: record the error and keep going with the games that are still outstanding. Stop launching new games only when the server or the browser runtime cannot continue. Wait for subagents that are already playing, then report with played set to the number of findings you actually have.

The main agent clusters those findings. It does not open the game again to re-judge a hand.

When you accept a finding:

- Keep a violation only when its rule id is a `[RULE-...]` label in `docs/game.md` section 5 and the finding includes a screenshot file that exists.
- Drop a violation that fails that check. If none remain and the hand ended in HARMONY, BAO-ZI, or an empty deck, count the game bug-free. Otherwise count it incomplete.
- A game the subagent marked with bugs, with at least one kept violation, counts once as **with bugs** even when it also violated other rules. It may enter each matching cluster.
- A game the subagent marked bug-free, with a real ending, stays bug-free.
- A stuck hand with no kept violation is incomplete.

## Report

Cluster by rule id. The cluster size is how many games kept a violation of that rule. Show **at most 3 samples** per cluster. Three is the cap, not a target. Choose the three whose seed, board, and log lines make the contradiction easiest to check.

Copy each chosen screenshot into the run folder as `game-<index>.png`. The same image may illustrate that game in every cluster that selected it. Delete every other screenshot under `games/`. The report and `qa-runs/` must not contain a fourth sample for any rule. Leave each `finding.json` in place so the counts can be checked.

Write `qa-runs/<UTC-timestamp>/report.md`. Follow `references/report-template.md`. Do not commit `qa-runs/`.

Show the same report in the reply, with the sample images. Required counts:

- games requested
- games played
- bug-free
- with bugs
- incomplete

Played must equal bug-free + with bugs + incomplete.

Include a **Run meta** section. Record UTC start, UTC end, and wall time. Say whether games ran in parallel or one at a time, and why. Include token usage only when this runtime exposes a total for the main agent and the subagents. When it does not, write `not exposed by this runtime`. Never estimate a token count.
