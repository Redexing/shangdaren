# Shangdaren (上大人) — Game Specification

This document defines the game rules, domain models, scoring system, and turn lifecycle for Shangdaren.

---

## 1. Overview & Objective

Shangdaren is a 3-player, turn-based card game originating from Hubei province, China. Players draw and exchange cards to organize their hands into structured melds. The objective is to achieve **HARMONY (和)** by forming a complete, valid 16-card partitioned hand meeting minimum point and reward thresholds.

---

## 2. Deck & Card Composition

The deck contains **96 total cards**: 24 unique Chinese characters with 4 identical copies each, organized into 8 suits of 3 characters:

| Suit Index | Type | Color | Characters |
|---|---|---|---|
| **0** | Meat (荤牌) | Red | 上, 大, 人 |
| **1** | Meat (荤牌) | Black | 丘, 乙, 几 |
| **2** | Meat (荤牌) | Red | 化, 三, 千 |
| **3** | Veggie (素牌) | Black | 七, 十, 土 |
| **4** | Veggie (素牌) | Red | 尔, 小, 生 |
| **5** | Veggie (素牌) | Black | 八, 九, 子 |
| **6** | Veggie (素牌) | Red | 佳, 作, 仁 |
| **7** | Veggie (素牌) | Black | 可, 知, 礼 |

- **Meat vs. Veggie**: Suits 0, 1, and 2 are Meat cards (higher value). Suits 3 through 7 are Veggie cards.
- **Color Rule**: Odd suits (indices 0, 2, 4, 6) are Red. Even suits (indices 1, 3, 5, 7) are Black.
- **Card Identity**: Each card instance has a unique `id` (0–95) and a `typeId` (0–23) computed as `(suiteIndex * 3) + characterIndex`.

---

## 3. Table Areas & Card Piles

Each player manages four distinct zones:
- **HAND (暗牌)**: Private cards held in hand (initially 15 cards).
- **EXPOSED (明牌)**: Face-up melds claimed on the table.
- **DISCARD (打牌)**: Cards intentionally discarded from hand.
- **PASSED (搬牌)**: Cards drawn from the deck by this player and declined.

Community zones:
- **Deck (公牌)**: The shared draw pile containing remaining unplayed cards.
- **Center Discard**: The active card currently in play and available for claims.

---

## 4. Melds & Scoring Specification

### 4.1 Melds Summary Table

| Meld | Description | Size | Meat Points | Veggie Points | Requires Discard? |
|---|---|---|---|---|---|
| **CHI (吃)** | Complete suit: all 3 sequential characters of a suit | 3 | 3 Fu | 0 Fu | Yes |
| **KOU (口)** | Partial suit: 2 distinct characters of the same suit | 2 | 2 Fu | 0 Fu | Yes |
| **PENG (碰)** | 3-of-a-kind claimed on another's drawn or passed card | 3 | 3 Fu | 2 Fu | Yes |
| **SAO (绍)** | 3-of-a-kind formed on a self-drawn card | 3 | 6 Fu | 4 Fu | Yes |
| **XIA-CE (下扯)** | 4-of-a-kind claimed from another's draw | 4 | 10 Fu | 6 Fu | **No** |
| **KAI-ZAO (开招)** | 4-of-a-kind self-drawn or upgraded from exposed SAO | 4 | 12 Fu | 8 Fu | **No** |
| **HALF-DRAGON (半龙)** | 4-of-a-kind + 1 other card of same suit (self-drawn) | 5 | 14 Fu | 8 Fu | Yes |
| **HALF-SNAKE (半蛇)** | 4-of-a-kind + 1 other card of same suit (claimed from other) | 5 | 12 Fu | 6 Fu | Yes |
| **DRAGON (龙)** | 4-of-a-kind + remaining 2 cards of suit (self-drawn) | 6 | 16 Fu | 8 Fu | Yes |
| **SNAKE (蛇)** | 4-of-a-kind + remaining 2 cards of suit (claimed from other) | 6 | 14 Fu | 6 Fu | Yes |

*Note: HALF-DRAGON and HALF-SNAKE count as 1 KOU for the Harmony partition requirement.*

### 4.2 Rewards (大) Table

Rewards stack additively and are awarded only to the player who wins with HARMONY:

| Reward Condition | Code Key | Rewards (大) |
|---|---|---|
| Exactly 10 Fu | `exact-10` | 1 |
| All Veggie cards | `all-veggie` | 1 |
| Self-drawn completing card from Deck | `self-draw` | 1 |
| Score $\ge 20$ Fu | `score-20` | 1 |
| Contains at least one full DRAGON or SNAKE | `dragon-snake` | 1 |
| Four-of-a-kind of 上, 七, or 可 | `special-quad` | 2 |
| All Meat cards | `all-meat` | 1 |
| Big Red (all Red cards) | `big-red` | 3 |
| Big Black (all Black cards) | `big-black` | 4 |

---

## 5. Labeled Rules Index

The following rules govern the game engine, validation logic, and test cases. Each rule has a unique label for direct reference in code and tests.

### Setup & Dealing
- **`[RULE-DECK-SIZE]`**: The deck consists of exactly 96 cards (24 unique characters, 4 copies each, 8 suits of 3 characters).
- **`[RULE-PLAYER-COUNT]`**: The game is strictly played with 3 players.
- **`[RULE-INITIAL-DEAL]`**: Each player is dealt 15 private cards into their HAND. Turn rotation is counter-clockwise. The starting player is chosen randomly.

### Turn Lifecycle & Draw
- **`[RULE-TURN-DRAW]`**: At the start of a turn, the active player draws 1 card from the Deck to the center area.
- **`[RULE-PRIMARY-PASS]`**: If the drawing player declines or passes a freshly drawn card, the card enters their PASSED pile and is offered to the immediate downstream player (counter-clockwise).
- **`[RULE-SECONDARY-PASS]`**: If the downstream player declines an offered passed card, the card remains in the passer's PASSED pile, and the downstream player begins their turn by drawing from the Deck.
- **`[RULE-RULE-6-RECLAMATION]`**: If a card in any player's PASSED pile is claimed by another player to form a meld, it is removed from that PASSED pile.

### Action Priority & Interrupts
- **`[RULE-INTERRUPT-PRIORITY]`**: When a card is revealed, actions resolve by priority:
  1. HARMONY claims.
  2. Quad and Trip claims (PENG, SAO, XIA-CE, KAI-ZAO, DRAGON, SNAKE).
  3. Drawing player actions (CHI, KOU, PASS).
- **`[RULE-MUST-CLAIM-MELDS]`**: If a card enables PENG, SAO, CHI, XIA-CE, KAI-ZAO, DRAGON, SNAKE, HALF-DRAGON, or HALF-SNAKE, the player MUST claim it. PASS is prohibited when a mandatory action exists.
- **`[RULE-MUST-CLAIM-HARMONY]`**: If a card completes HARMONY and is self-drawn or drawn/passed by the upstream player (right), claiming HARMONY is mandatory. If drawn by the downstream player (left), claiming HARMONY is optional.
- **`[RULE-OPTIONAL-KOU]`**: Claiming a card to form a KOU is always optional.

### KOU Constraints
- **`[RULE-KOU-MAX-EXPOSED]`**: A player may have at most 2 exposed KOU melds on the table at any time.
- **`[RULE-KOU-NO-DO-OVER]`**: A player cannot form a KOU in a suit if they have previously discarded any card of that suit, passed a drawn card of that suit, or their upstream player has previously passed a card of that suit. The card currently being offered by the upstream player remains eligible for KOU. This restriction does not block CHI or HARMONY.

### Discard Rules
- **`[RULE-DISCARD-REQUIRED]`**: Every meld claim requires discarding one card from HAND, with the sole exception of quads (`[RULE-DISCARD-EXEMPT-QUADS]`).
- **`[RULE-DISCARD-EXEMPT-QUADS]`**: Forming XIA-CE or KAI-ZAO does NOT require a discard.
- **`[RULE-DISCARD-RESTRICTION-TRIP]`**: A card cannot be discarded if it is part of a 3-of-a-kind or 4-of-a-kind in HAND.
- **`[RULE-DISCARD-RESTRICTION-CHI]`**: A card cannot be discarded if it is essential to maintaining an existing complete CHI suite in HAND.
- **`[RULE-DISCARD-RESTRICTION-MELD]`**: A player cannot discard a card that is part of the meld currently being formed.
- **`[RULE-BAO-ZI]`**: When a player completes a meld that requires a discard but has 0 cards left in HAND, that player triggers BAO-ZI. The triggering player loses immediately, and the other two players win.

### Harmony (Winning) Conditions
- **`[RULE-HARMONY-CARD-COUNT]`**: The total card count must equal $16 + \text{exposedQuadsCount}$ (15 in hand + 1 completing card, plus 1 for each exposed 4-of-a-kind quad).
- **`[RULE-HARMONY-FULL-PARTITION]`**: All cards (HAND + EXPOSED + completing card) must partition completely into valid melds.
- **`[RULE-HARMONY-EXACT-2-KOU]`**: The winning partition must contain exactly 2 KOU melds (HALF-DRAGON and HALF-SNAKE count as 1 KOU).
- **`[RULE-HARMONY-SCORE-THRESHOLD]`**: Total score must be $\ge 10$ Fu. This threshold is waived if every card in the winning set is a Veggie card.
- **`[RULE-HARMONY-MIN-REWARDS]`**: The winning hand must score at least 1 Reward (大). A hand meeting all other criteria with 0 rewards cannot win and must continue playing. If a subsequent mandatory meld leaves no legal discard, BAO-ZI is triggered.
- **`[RULE-REWARDS-WINNER-ONLY]`**: Rewards are credited only to the player declaring HARMONY. Non-winners gain 0 rewards.

### Game End
- **`[RULE-DECK-EXHAUSTION]`**: If the Deck is completely depleted and no player has declared HARMONY, the game ends in a draw (tie).
