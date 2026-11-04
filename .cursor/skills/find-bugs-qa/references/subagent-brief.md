# One watched game

You play a single watched bot game and return one finding. You do not play another game, write the QA report, edit the repo, or change git.

The task prompt has the game index, the page URL, and the output directory. Follow those values.

If the URL contains `probe=`, this is not a game. Open that URL and return the URL that actually loaded. Do not click Watch, do not clear storage, and do not write `finding.json`.

Otherwise read `docs/game.md` before judging. Section 5 is the only source of `[RULE-...]` ids. Sections 2–4 define the deck, piles, melds, and points. A bug is a board or console that contradicts one of those ids. Timing, speech bubbles, voice, layout, and uncertain readings are not bugs. `how-to.html`, `about.html`, and `docs/archived/` are not the spec when they disagree with `docs/game.md`.

## Play with the script

Run the command from the task prompt. It is `scripts/qa-robots.mjs` with `--games 1`, this game's `--index`, `--url`, `--out`, and `--port`. Do not write another driver and do not click through the table yourself.

The script opens one Chrome window wider than 800px, drops a stale service worker and cache, sets English and sound off, sets the browser zoom to 50%, clicks Watch once, and waits for the ending. The 50% zoom happens before Watch so the final screenshot contains every card in HAND, EXPOSED, DISCARD, and PASSED. That zoom is not a layout bug. It records `alert` text instead of leaving a blocking dialog. It writes three files into the output directory:

- `capture.json` — seed, alert, ending, elapsed time, mechanical anomalies, and the console excerpt
- `console.txt` — the same excerpt: one copy of each line from `[DECK] Initializing with seed:` through the terminal line, plus any `console.error`
- `board.png` — the full page after the hand ends, including `#players-area` and `#dashboard`

Exit codes:

- `0`: the hand reached an ending. Judge `capture.json` and `board.png`.
- `2`: the draw was still on the production delays. Return `status: "incomplete"` and set `error` to `stale cached constants`. Do not run the script again for this run.
- `1`: the hand stalled or Chrome failed. If `board.png` exists, judge that table. Otherwise return `status: "incomplete"` and set `error` from `capture.json` when that file exists, or to the script's stderr.

`capture.json` field `ending` is `harmony`, `bao-zi`, `draw`, `stuck`, or `error`. `anomalies` are mechanical notes (a duplicated card id, a hand count that does not match the label, a console error). They are not violations until one of them contradicts a section-5 rule. Timing, speech bubbles, voice, and layout stay out of the report unless a section-5 id fits.

Each seat shows HAND, EXPOSED (with a meld label), DISCARD, PASSED, card count, and points. Points are a clue. The rule text decides whether the score is legal.

## Finding

Write `finding.json` in the output directory and return the same object:

```json
{
  "index": 1,
  "status": "bug-free",
  "seed": "",
  "ending": "harmony",
  "alert": "",
  "violations": [],
  "screenshots": ["games/<index>/board.png"],
  "consoleExcerpt": "",
  "error": null
}
```

`status` is `bug-free`, `with-bugs`, or `incomplete`. `ending` is `harmony`, `bao-zi`, `draw`, `stuck`, or `error`.

Use `with-bugs` when the board or the excerpt contradicts one or more section-5 rules. Each violation has `ruleId` (for example `RULE-DISCARD-REQUIRED`) and `summary` (one sentence: what the rule requires, and what this table did). Put the seed line, the lines that show the bad action, and the terminal line when there is one in `consoleExcerpt`. If the contradiction is only on the board, say that in the summary and still include the seed line and the terminal line.

Use `bug-free` only when the hand ended in HARMONY, BAO-ZI, or an empty deck and no section-5 rule was contradicted.

Use `incomplete` when the hand did not end and no rule id fits, or when the browser failed. Set `error` to the reason. A stuck hand that does contradict a named rule is `with-bugs`, with `ending: "stuck"`.

`screenshots` lists every part of this board, relative to the run folder: `games/<index>/board.png`, or `games/<index>/board-1.png`, `games/<index>/board-2.png`, and so on. Each path must exist on disk. Return the finding to the main agent. Then stop.
