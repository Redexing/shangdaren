# Shangdaren (上大人) — Glossary of Terms

A bilingual dictionary of domain and UI terms distilled from `src/js/translations.js` and the game engine.

---

## 1. Melds & Actions (牌组与动作)

| English Term | Chinese Term | Description |
|---|---|---|
| **CHI** | 吃 | Meld of all 3 distinct characters of a suit |
| **KOU** | 口 | Meld of 2 distinct characters of the same suit |
| **PENG** | 碰 | 3-of-a-kind claimed from another player's drawn or passed card |
| **SAO** | 绍 | 3-of-a-kind formed on a self-drawn card |
| **XIA-CE** | 下扯 | 4-of-a-kind claimed from another player's drawn card |
| **KAI-ZAO** | 开招 | 4-of-a-kind self-drawn or upgraded from an exposed SAO |
| **HALF-DRAGON** | 半龙 | 4-of-a-kind + 1 other card of the same suit (self-drawn) |
| **HALF-SNAKE** | 半蛇 | 4-of-a-kind + 1 other card of the same suit (claimed from other) |
| **DRAGON** | 龙 | 4-of-a-kind + remaining 2 cards of the same suit (self-drawn) |
| **SNAKE** | 蛇 | 4-of-a-kind + remaining 2 cards of the same suit (claimed from other) |
| **TWO-DRAGONS-TUSSLING** | 双龙抱柱 | Two 4-of-a-kind from the same suit (each formed under standard quad rules) + 1 extra card of the same suit from HAND |
| **HARMONY** | 和 | Winning hand declaration |
| **Meld** | 组合 | Any valid card formation or combination |
| **Draw** | 翻牌 | Drawing a card from the deck |
| **PASS** | 不要 | Passing on a self-drawn or passed card |
| **DECLINE** | 没有碰 | Declining to interrupt another player's draw |
| **DISCARD** | 打牌 | Discarding a card from hand |
| **CONFIRM DISCARD** | 确认打牌 | Button confirming selected discard |
| **Discard Selected** | 打出选中牌 | Action to play the selected card |

---

## 2. Piles & Card Areas (牌区与牌堆)

| English Term | Chinese Term | Description |
|---|---|---|
| **Deck** | 公牌 | Center community draw pile |
| **Empty** | 亮牌 | Empty state indicator for the center card area |
| **HAND** | 暗牌 | Private in-hand cards held by a player |
| **EXPOSED** | 明牌 | Face-up melds displayed on the table |
| **DISCARD** | 打牌 | Pile of cards discarded from hand |
| **PASSED** | 搬牌 | Pile of cards drawn from deck and immediately passed |

---

## 3. Card Types & Attributes (牌型与属性)

| English Term | Chinese Term | Description |
|---|---|---|
| **Meat Cards** | 荤牌 | High-value cards (Suits 0, 1, 2) |
| **Veggie Cards** | 素牌 | Standard-value cards (Suits 3, 4, 5, 6, 7) |
| **Red Cards** | 红牌 | Cards with odd suit indices (0, 2, 4, 6) |
| **Black Cards** | 黑牌 | Cards with even suit indices (1, 3, 5, 7) |
| **Suit** | 系列 | One of the 8 character groups of 3 cards each |

---

## 4. Scoring, States & Outcomes (分值与状态)

| English Term | Chinese Term | Description |
|---|---|---|
| **Points / Fu** | 福 | Standard score unit earned by melds |
| **Reward / Da** | 大 | Bonus reward unit earned upon winning |
| **BAO-ZI** | 包子 | Loss condition triggered by having no legal card to discard |
| **Cards** | 牌数 | Total count of cards in a hand or pile |
| **Current Turn** | 牌权 | Indicator marking the active player |
| **Win %** | 胜场率 | Percentage of games won |
| **Game Over** | 游戏结束 | Round completion state |
| **None** | 无 | Empty or absence indicator |

---

## 5. Players & Table Positions (玩家与方位)

| English Term | Chinese Term | Description |
|---|---|---|
| **You** | 你 | Human player (Player 0) |
| **Bot** | 机器人 | AI player |
| **Left** | 左 | Downstream player relative to turn order (counter-clockwise) |
| **Right** | 右 | Upstream player relative to turn order (counter-clockwise) |
| **Bot 1 / 2 / 3** | 机器人 1 / 2 / 3 | Names assigned to AI players |

---

## 6. Navigation & UI Settings (界面与导航)

| English Term | Chinese Term | Description |
|---|---|---|
| **New Game (Play)** | 新牌局 | Starts a human vs. bots game |
| **Watch Bot Game** | 观摩机器人对局 | Starts an automated 3-bot game |
| **Settings** | 设置 | Settings panel |
| **Language** | 语言 | Language toggle control |
| **About** | 关于 | Historical and cultural background page |
| **How-to** | 玩法 | Gameplay and scoring rules page |
| **Versions** | 版本 | Version history and roadmap page |
