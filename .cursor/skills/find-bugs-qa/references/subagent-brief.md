# One watched game

You play a single watched bot game and return one finding. You do not play another game, write the QA report, edit the repo, or change git.

The task prompt has the game index, the page URL, and the output directory. Follow those values.

If the URL contains `probe=`, this is not a game. Open that URL and return the URL that actually loaded. Do not click Watch, do not clear storage, and do not write `finding.json`.

Otherwise read `docs/game.md` before judging. Section 5 is the only source of `[RULE-...]` ids. Sections 2–4 define the deck, piles, melds, and points. A bug is a board or console that contradicts one of those ids. Timing, speech bubbles, voice, layout, and uncertain readings are not bugs. `how-to.html`, `about.html`, and `docs/archived/` are not the spec when they disagree with `docs/game.md`.

## Browser

1. Open the task URL in your own browser at a viewport **wider than 800px** (1280×900 is enough). At 800px and below the page is a carousel and two seats are off screen.
2. `sw.js` is cache-first and may still be holding a slow `src/js/constants.js`. On this page, unregister every service worker, delete every Cache Storage entry, and reload. The page does not deal or draw until Watch is clicked, so do not judge speed yet.
3. Set `#lang-select` to `en`, then `#sound-select` to `none`.
4. Click `#btn-watch` (Watch Bot Game) once. Do not click `#btn-new-game`. Watch mode deals three bots and shows every HAND face up.
5. Time that same hand. `Game started` should be followed by the draw in well under a second. If the gap is still about 0.5–3 seconds, the page is running the cached production delays. Return `status: "incomplete"` and set `error` to `stale cached constants`. Do not click Watch again.
6. Wait for an ending: a blocking alert, or a console line containing `declares HARMONY`, `is BAO-ZI`, or `Deck empty. Draw game.` `main.js` calls `alert` on game over. The alert text is `Game Over! Winner: ...` or `Game Over! ... is BAO-ZI (no cards to discard). Everyone else wins!` A draw says `Game Over! Winner: None`.
7. If three minutes pass with no new console line, or five minutes pass with no ending, treat the hand as stuck and capture it.
8. Record the alert text, then dismiss the alert. The board underneath is the final table. Screenshot `#players-area` and `#dashboard` together before any later click replaces them. If one image cannot fit the table, capture the whole page in parts and save every part in the output directory. Name them `board-1.png`, `board-2.png`, and so on, in capture order. A single image is `board.png`. That set is still this one game's board.
9. Save the console slice from this hand's `[DECK] Initializing with seed:` through the terminal line. `game.log` prints each line once, and `main.js` prints it again with a `[GAME]` prefix. Keep one copy. Also keep any `console.error` from this hand.

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
