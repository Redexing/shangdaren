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
| **TWO-DRAGONS-TUSSLING (双龙抱柱)** | Two 4-of-a-kind of same suit + 1 extra card of suit from HAND | 9 | 22 / 24 / 26 Fu (sum of two quads + 2 Fu) | 12 / 14 / 16 Fu (sum of two quads + 0 Fu) | Yes |

*Note: HALF-DRAGON and HALF-SNAKE count as 1 KOU for the Harmony partition requirement and toward the exposed limit of 2 KOU-equivalents (`[RULE-KOU-MAX-EXPOSED]`).*

### 4.2 Rewards (大) Table

Rewards stack additively and are awarded only to the player who wins with HARMONY:

| Reward Condition | Code Key | Rewards (大) |
|---|---|---|
| Exactly 10 Fu | `exact-10` | 1 |
| All Veggie cards | `all-veggie` | 1 |
| Self-drawn completing card from Deck | `self-draw` | 1 |
| Score $\ge 20$ Fu | `score-20` | 1 |
| Contains at least one full DRAGON or SNAKE | `dragon-snake` | 1 |
| TWO-DRAGONS-TUSSLING / 双龙抱柱 (upgraded from HALF-DRAGON / HALF-SNAKE) | `two-dragons-tussling` | 3 |
| Doubled-up / 板儿高: each pair of identical CHI (same suit), in HAND or EXPOSED | `doubled-up` | 1 |
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
- **`[RULE-PASSED-RECLAMATION]`**: If a card in any player's PASSED pile is claimed by another player to form a meld, it is removed from that PASSED pile.

### Action Priority & Interrupts
- **`[RULE-INTERRUPT-PRIORITY]`**: When a card is revealed, actions resolve by priority:
  1. HARMONY claims.
  2. Quad and Trip claims (PENG, SAO, XIA-CE, KAI-ZAO, DRAGON, SNAKE).
  3. Drawing player actions (CHI, KOU, PASS).
- **`[RULE-MUST-CLAIM-MELDS]`**: If a card enables PENG, SAO, CHI, XIA-CE, KAI-ZAO, DRAGON, SNAKE, HALF-DRAGON, or HALF-SNAKE, the player MUST claim it. PASS is prohibited when a mandatory action exists.
- **`[RULE-MUST-CLAIM-HARMONY]`**: If a card completes HARMONY and is self-drawn or drawn/passed by the upstream player (right), claiming HARMONY is mandatory. If drawn by the downstream player (left), claiming HARMONY is optional.
- **`[RULE-OPTIONAL-KOU]`**: Claiming a card to form a KOU is always optional.

### KOU Constraints
- **`[RULE-KOU-MAX-EXPOSED]`**: A player may have at most 2 exposed KOU-equivalent melds. KOU, HALF-DRAGON, and HALF-SNAKE each count as one. A new KOU is not offered once two are already exposed. Completing an exposed KOU into CHI remains allowed.
- **`[RULE-KOU-NO-DO-OVER]`**: A player cannot form a KOU in a suit if they have previously discarded any card of that suit, passed a drawn card of that suit, or their upstream player has previously passed a card of that suit. The card currently being offered by the upstream player remains eligible for KOU. This restriction does not block CHI or HARMONY.
- **`[RULE-KOU-NO-BREAK-HAND]`**: A KOU cannot take a hand card that is part of an in-hand 3-of-a-kind or 4-of-a-kind, or a card that is essential to an existing complete CHI in hand. Those cards stay locked, the same as they cannot be discarded. A spare copy that is not essential to the CHI may still form a KOU.

### Meld Formation
- **`[RULE-EXPOSED-PRIORITY]`**: When an incoming card can form or grow a meld in both EXPOSED and HAND, upgrading the EXPOSED meld takes priority (e.g., if a player holds an 尔小 KOU in both EXPOSED and HAND, an incoming 生 upgrades the EXPOSED KOU to CHI first).
- **`[RULE-SUIT-MELD-PRIORITY]`**: Within one suit, cards are grouped in this order: 4-of-a-kind patterns (TWO-DRAGONS-TUSSLING, then DRAGON/SNAKE, then HALF-DRAGON/HALF-SNAKE, then KAI-ZAO/XIA-CE), then 3-of-a-kind (SAO/PENG), then CHI, then KOU. A 3-of-a-kind or 4-of-a-kind is never split across CHI or KOU. A shorter 4-of-a-kind shape is used only when the longer one cannot finish a perfect partition of the whole hand. The meld that contains the completing card is the self-drawn type (SAO, KAI-ZAO, DRAGON, HALF-DRAGON) when this player drew it, and the claimed type (PENG, XIA-CE, SNAKE, HALF-SNAKE) when another player drew or passed it.
- **`[RULE-MELD-NO-SPLIT]`**: Melds in EXPOSED can grow or merge, but can never be split. On the winning reveal, an exposed meld keeps the type it was formed with. A concealed 3-of-a-kind is shown as SAO. A 3-of-a-kind completed by another player's card is PENG, even when that card is the card that declares HARMONY.
- **`[RULE-PENG-IMMUTABLE]`**: An exposed PENG meld cannot be further grown or reformed.
- **`[RULE-MELD-UPGRADE-KOU]`**: An exposed KOU can grow into a CHI upon claiming the missing third character of the suit.
- **`[RULE-MELD-UPGRADE-SAO]`**: A 3-of-a-kind in HAND or an exposed SAO (self-drawn 3-of-a-kind in EXPOSED) can grow when its 4th identical card arrives into:
  - **KAI-ZAO** or **XIA-CE** (if no same-suit cards are attached);
  - **HALF-DRAGON** or **HALF-SNAKE** if the player already holds 1 other card of the same suit in HAND at that moment (this extra card cannot be added later from a future draw or another player). The player must take this longer meld; a plain KAI-ZAO or XIA-CE is not allowed. If that HALF-DRAGON or HALF-SNAKE would be a third exposed KOU-equivalent, the player is BAO-ZI (`[RULE-BAO-ZI]`);
  - **DRAGON** or **SNAKE** if the player holds the other 2 cards of the same suit in HAND or in an exposed KOU.
- **`[RULE-MELD-UPGRADE-TWO-DRAGONS]`**: An exposed HALF-DRAGON or HALF-SNAKE can grow into a **TWO-DRAGONS-TUSSLING (双龙抱柱)** meld when a second 4-of-a-kind of the same suit is formed (under standard quad rules) alongside the 1 extra card of that suit from HAND. Its Fu score equals the sum of how the two 4-of-a-kind were formed (KAI-ZAO or XIA-CE), plus 2 Fu for the extra card if it is a Meat suit (max 26 Fu for two self-drawn Meat quads: $12 + 12 + 2$). It earns 3 rewards (大) by itself (2 base rewards for counting as two dragons/snakes, plus 1 bonus reward for being in the same suit).

### Discard Rules
- **`[RULE-DISCARD-REQUIRED]`**: Every meld claim requires discarding one card from HAND, with the sole exception of quads (`[RULE-DISCARD-EXEMPT-QUADS]`) and revealing a naked in-hand quad (`[RULE-NAKED-QUAD-REVEAL]`).
- **`[RULE-DISCARD-EXEMPT-QUADS]`**: Forming XIA-CE or KAI-ZAO does NOT require a discard.
- **`[RULE-NAKED-QUAD-REVEAL]`**: When a player holds a naked 4-of-a-kind in HAND (with no other cards from the same suit), the first time they are required to discard a card, they must instead reveal the 4-of-a-kind in EXPOSED and skip the discard (since each naked 4-of-a-kind requires one extra card in total to reach HARMONY).
- **`[RULE-DISCARD-RESTRICTION-TRIP]`**: A card cannot be discarded if it is part of a 3-of-a-kind or 4-of-a-kind in HAND.
- **`[RULE-DISCARD-RESTRICTION-CHI]`**: A card cannot be discarded if it is essential to maintaining an existing complete CHI suite in HAND.
- **`[RULE-DISCARD-RESTRICTION-MELD]`**: When claiming an active card to form a meld that requires a follow-up discard, the discard must come from the player's *remaining* in-hand cards. A player cannot discard any card that is committed to forming that new meld.
  - *Example*: A player claims CHI on an incoming 人 using 上 and 大 from their HAND. The player must discard a third, unrelated card from HAND; they cannot discard that 上 or 大.
- **`[RULE-BAO-ZI]`**: When a player completes a meld that requires a discard but has 0 cards left in HAND, that player triggers BAO-ZI. The same loss occurs when a mandatory meld creates a third exposed KOU-equivalent (KOU, HALF-DRAGON, or HALF-SNAKE): the meld is formed and that player loses immediately, even if HAND still has a card that could be discarded. The triggering player loses, and the other two players win, each receiving 1 reward (大).

### Harmony (Winning) Conditions
- **`[RULE-HARMONY-CARD-COUNT]`**: The total card count must equal $16 + \text{exposedQuadsCount}$ (15 in hand + 1 completing card, plus 1 for each exposed 4-of-a-kind quad).
- **`[RULE-HARMONY-FULL-PARTITION]`**: All cards (HAND + EXPOSED + completing card) must partition completely into valid melds, following `[RULE-SUIT-MELD-PRIORITY]`.
- **`[RULE-HARMONY-EXACT-2-KOU]`**: The winning partition must contain exactly 2 KOU melds (HALF-DRAGON and HALF-SNAKE count as 1 KOU).
- **`[RULE-HARMONY-SCORE-THRESHOLD]`**: Total score must be $\ge 10$ Fu. This threshold is waived when every card in the winning set is a Veggie card and the winning partition contains neither a SAO nor a meld that includes a 4-of-a-kind. SAO, XIA-CE, KAI-ZAO, DRAGON, SNAKE, HALF-DRAGON, HALF-SNAKE, and TWO-DRAGONS-TUSSLING each remove the waiver, whether that meld is in HAND or EXPOSED. PENG, CHI, and KOU do not. A hand that loses the waiver must still reach 10 Fu and meet every other Harmony requirement, including at least 1 reward (大). The all-veggie reward itself is unchanged.
- **`[RULE-REWARD-DOUBLED-UP]`**: Each pair of identical CHI melds in the winning partition scores 1 reward (大), called 板儿高 (Doubled-up). Two CHI are identical when they are the same suit. CHI in HAND and CHI in EXPOSED both count, including a CHI completed by the winning card. Only melds that remain CHI in the winning partition count: `[RULE-SUIT-MELD-PRIORITY]` keeps a 3-of-a-kind or 4-of-a-kind whole, so those cards are not CHI. The reward stacks with every other reward and does not waive the 10 Fu threshold.
- **`[RULE-HARMONY-MIN-REWARDS]`**: The winning hand must score at least 1 Reward (大). A hand meeting all other criteria with 0 rewards cannot win and must continue playing. If a subsequent mandatory meld leaves no legal discard, BAO-ZI is triggered.
- **`[RULE-REWARDS-WINNER-ONLY]`**: In a HARMONY win, rewards are credited only to the player declaring HARMONY. In a BAO-ZI game, each of the two winning players receives 1 reward (大). Non-winners receive 0 rewards.

### Game End
- **`[RULE-DECK-EXHAUSTION]`**: If the Deck is completely depleted and no player has declared HARMONY, the game ends in a draw (tie).
