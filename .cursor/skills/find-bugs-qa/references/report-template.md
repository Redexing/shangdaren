# Find-bugs QA report

Use this skeleton for `qa-runs/<UTC-timestamp>/report.md`. Omit a cluster that has zero games. Never add a fourth sample under a cluster.

```markdown
# Find-bugs QA

## Counts

| | |
|---|---|
| Requested | 100 |
| Played | 100 |
| Bug-free | 0 |
| With bugs | 0 |
| Incomplete | 0 |

Played = bug-free + with bugs + incomplete.

Branch: `<branch>`
Constants: production delays, or `GAME_SPEEDS` at 40ms (local, not committed)
Execution: parallel (each subagent had its own browser) or one at a time (shared browser)

## Clusters

### `[RULE-...]` — N games

<What the rule requires, and what these games did instead.>

Showing <1, 2, or 3> of N.

#### Sample 1 — game `<index>`, seed `<seed>`

<One sentence: the contradiction on this table.>

![Final board, game <index>](./game-<index>.png)

```text
[DECK] Initializing with seed: <seed>
<the lines that show the violation>
<terminal line, if the hand ended>
```

#### Sample 2 — game `<index>`, seed `<seed>`

...

#### Sample 3 — game `<index>`, seed `<seed>`

...

## Run meta

- Started: `<YYYY-MM-DD HH:MM:SS UTC>`
- Finished: `<YYYY-MM-DD HH:MM:SS UTC>`
- Wall time: `<duration>`
- Execution: `<parallel or one at a time, and why>`
- Tokens: `<total for the main agent and the subagents, or "not exposed by this runtime">`
```

When a board needs more than one image, list `game-<index>-1.png`, `game-<index>-2.png`, and the rest under that sample only. They are still one sample.
