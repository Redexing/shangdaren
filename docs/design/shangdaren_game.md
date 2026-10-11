 I want to build a Progressive Web App that is kind of like a bridge game (and in some sense similar to Majong game), but with different type of cards, and different required number of players, and of course different rules.

# The game is as follows:
1. there are 24 types of cards, with 4 of each.  These cards are organized into suites of 8, they are represented by Chinese characters as follows: 上，大， 人； 丘，乙，几；化，三，千； 七，十，土；尔，小，生；八，九，子；佳，作，仁；可，知，礼。The odd suites (1st, 3rd, 5th, 7th) should be rendered in red color, while the rest rendered in black color. Also the first three suites are called MEAT cards, while the rest are called VEGGIE cards. 
2. the game is played by 3 persons; taking turns drawing cards from a shuffled deck;  each should initially draw 15 private cards. Then, the first person shall draw a new card from the deck, and let it shown to all players.  All players plays according to the game rules.
3. game rules:
a) for each new card, there are these potential actions:
   1. CHI: form 3 differentcards from the same suite;
   2. KOU: form 2 different cards from the same suite;
   3. PENG or SAO: form 3 of a kind; (PENG, when card is drew by others; SAO, drew by oneself)
   4. XIA-CE or KAI-ZAO: form 4 of a kind; (XIA-CE, when card is drew by others; KAI-ZAO, drew by oneself)
   5. DRAGON or SNAKE: 4 of a kind,plus two other cards from the same suite; (DRAGON, when card is drew by oneself; SNAKE, drew by others)
   6. HALF-DRAGON or HALF-SNAKE: 4 of a kind, plus one other card from the same suite. (HALF-DRAGON, when card is drew by oneself; HALF-SNAKE, drew by others)
   7. HARMONY: declare end of game and oneself as winner, if all conditions for HARMONY are met (see below).
   8. PASS: finally drawing player can pass the card he drew. Turn goes to next player.
b) when a potential action is eligible and chosen by a player, the player takes the card in question, and relevant cards from his hand, and display the formed meld to others;  he then has to discard a card from his hand, and the turn goes to the next player in counter-clock wise direction. He draws a card from center pile, and a new round begins with the same rules here. Exception: XIA-CE and KAI-ZAO don't require discarding cards. Once they are triggered, the next player takes turn and continues the game.
   1. one can only discard that is not forming a complete suite; or three or four of the same kind.
   2. when a person has break a "KOU" to discard one of the card, he cannot form another KOU from the same suite, unless it's his last step in order to declare "HARMONY".
   3. a player can only discard cards from the 15 private cards he initially drew.
   4. when a player is required to discard a card, but has no more private cards, the game ends in a BAO-ZI state, with the player being the only loser and the other two players being winners.
c) conditions for declare HARMONY:
   1. a person has arranged all his cards, including the pending new card (for a total of 16 cards), into well-formed melds: including 2 and only 2 KOUs; for the purpose of this check, HALF-DRAGON and HALF-SNAKE are counted as one KOU; and
   2. the 16 cards pass the the scoring rule (see rules below).
d) scoring rules are as follows:
   1. three different cards in CHI from MEAT suites, are worthy 3 points; VEGGIE cards has no points.
   2. two cards in KOU from the same MEAT suite, are worth of 2 points; similarly, VEGGIE KOU has no points.
   3. three of a kind in SAO, is worth of 6 points for MEAT cards, 4 points for VEGGIE cards.  Three of a kind in PENG, is worth of 3 points for MEAT cards, 2 points for VEGGIE cards.
   4. four of a kind in KAI-ZAO, is worth of 12 points for MEAT cards, 8 points for VEGGIE cards.  Four of a kind in XIA-CE, is worth of 10 points for MEAT cards, 6 points for VEGGIE cards.
   5. for MEAT cards, 16 points for DRAGON, 14 points for HALF DRAGON; for VEGGIE cards, 8 points for DRAGON or HALF DRAGON. 
   6. for MEAT cards, 14 points for SNAKE, 12 points for HALF SNAKE; for VEGGIE cards, 6 points for SNAKE or HALF SNAKE.
   7. a player needs at least 10 points to declare "HARMONY".
   8. when counting scores, don't forget about cards in the HAND also have points.
e) "must-triggerd rules": 
   1. when a person draw a card, anyone has two or three of the same card has to accept the card, to form three of a kind PENG (with card drew by others) or SAO (with card drew by himself), or four of a kind XIA-CE (with card drew by others) or KAI-ZAO (with card drew by himself). 
   2. When a person PASS a card, if for the next person, CHI can be triggered with the passed card, then the next person has to accept the card by pick CHI action.  He then needs to discard a card, as per usual rule, or declare HARMONY or BAO-ZI. The turn then goes to his next player.
f) If every card from the center pile are drew, and no one is able to declare "HARMONY", the game ends in a tie.
g) each game starts from a random person.
h) discarded cards cannot be used by anyone; they are kept separately for each person and laid on the table for everyone to see. These cards are information-only for players.


# The game UI:
a) this should be a typical card game UI, with a table and 2 persons represented as avartars, and another person represented by the user that is running this app, either as himself, or he sees the view from a third robotic player (for example, to learn the rule of the game).
b) each card, unlike bridge cards, should be represented as a slim rectangular shape, with the card's chinese charater rendered on both ends (of the same side; the other side should be masked as some sort of pattern, just like poker cards).
c) for the main user's view: he has 4 sections:
   1. HAND: for his private cards, which typically shrinks as game goes on, arranged as a row.
   2. EXPOSED: the well-formed melds are kept in this section.
   3. DISCARDS: cards he discarded, in order.
   4. PASSED: cards he drew, but passed.
d) for the other two players (either backed by real user over the internet, or robotic players), we don't see their private cards from initial drawings; but we do see the other three sections: EXPOSED, DISCARDS, and PASSED.
e) as each player play their turn, if they formed something, the app should briefly (like 2 seconds) show a almost like speech bubble, describing what format he arranged in that hand, ie. KOU, CHI, PENG, SAO, DRAGON, HALF DRAGON, or HARMONY etc.
f) after a player declares HARMONY, his private cards should be revealed on the table, for everyone to see.
g) after HARMONY is declared, this game ends, the game UI should freeze. Each player should be presented a "NEW GAME" button, only after every player clicked the button, a new game will be started.

## Additional instructions for the UI design:

Let's add a setting to the app, to start the game with all three players as robot players, and user can see all three players' hands and cards;   play the turns slowly, but highlight which player's turn it is with a red arrow pointing to him.  Each play should pause for 3 seconds for the user to follow.

If a freshly drew card is flipped, each player should be presented with eligible game actions: like PENG, SAO, DRAGON, HALF DRAGON etc.   

When PASS is chosen, the card should be moved to the PASSED pile;  when other meld forming actions are chosen, he should click a card from his HAND to be moved to DISCARDS pile, then the drew card and necessary cards from his hand to form the meld, which should be moved to and displayed in the EXPOSED section. In the EXPOSED section, instead of having each meld on its own row, they should be tiled together for a more compact view. 

UI-wise, the cards in play should be high-lighted, by for example changing the cards' border color to blue; keep the highlight for a 3 seconds (and make this a configurable parameter of the game). And once the next player's turn starts, reset the cards UI to default. 

When a player has clicked a card to discard, a CONFIRM button should be enabled, only the player clicks the CONFIRM button, the selected card should be moved to the DISCARDS pile.   Robotic players can skip this step, and simply move the selected card to the DISCARDS pile.

The robot players' turn should be progressing automatically.  We just need to see the results from their turn, i.e. what card was drew, the resulting updated EXPOSED, DISCARDS, PASSED sections. Similarly after each robot's turn finishes,  highlight the cards involved in blue color; and freeze game state and UI for 1 second.

There should be a DECLINE button for human player, which should be triggered when other players draw a new card, to indicate if he can form a 3 of a kind or 4 of a kind.  Only when all other players clicked DECLINE, the drawing player will continue the game according to the usual rule.

Alongside "New Game" button, present a "Watch Bot Game" button, when clicked, all players played by robots. The user of the app will see all players' all 4 sections, including private cards in HAND section. 

More UI preferences:
* move the language setting section to the header section, aliged to page right.
* add a breadcum menu in the header section, aligned to page left.  When clicked, it should show three links called "About", "How-to", "Versions", like to three new static html files named accordingly.
* the header section should disappear as users scroll.
* Merge  "community-area" with the "controls" area and make them stay effectively in a row, with  community elements laid to the left, and controls button laid to the right.   This new merged area should always stay visible, as user scroll up or down the game page.

## Multi-language support

Add a settings section in the "community-area" of the UI elements. Add a UI language choices, with Simplified Chinese (default) and English as options. 

For all the UI elements wiht text, except cards themselves, use the following translation tables:
English  Chinese
KOU      口
CHI      吃
PENG     碰
SAO      绍
XIA-CE   下扯
KAI-ZAO  开招
DRAGON   龙
HALF-DRAGON  半龙
SNAKE    蛇
HALF-SNAKE 半蛇
HARMONY  和
Bot      机器人
Points   福
Cards    牌数
'Current Turn' 牌权
Deck     公牌
Empty    亮牌
DISCARD  打牌
PASSED   搬牌
EXPOSED  明牌
HAND     暗牌
‘New Game (Play)' 新牌局
‘Watch Bot Game' 观摩机器人对局
PASS     不要
DECLINE  没有碰


# Clarification on game rules:

* there can be at most 2 KOU one can form in the EXPOSED section. After that, they cannot form new KOU, but they can form CHI onto these KOU in the exposed section.

* If the player before your run put a card in the PASSED pile, you have to follow must-rule to form a CHI, if you can with cards in hand or in the exposed section (both two cards have to be either from HAND or from EXPOSED section; it cannot be one from each section).  If CHI is triggered in this case, the player don't draw additional card from center pile. It's next player's turn.

* If a player's hand is empty and cannot declare HARMONY, he continue the game according to the usually rule, until he either can declare HARMONY, or the center pile is empty, or his hand is forced because he has no card to discard after a move. In this final case, the game ends in BAO-ZI, all other players are considered winner, except him.

* A player's points should be tracked automatically; the current points for the POV player should be displayed in the POV player's area; the current points for the other two players should not be shown, unless we are in "Watch Bot Game" mode. Don't forget to count points for melds that can be formed among private cards in HAND section.

* If the player before you PASS on a card, then current player has 3 choices: CHI, KOU, or DECLINE.  If he chooses CHI or KOU, he needs to discard a card from his hand to form the well-formed format. The card moves from previous player's PASSED pile into a meld in current player's EXPOSED section. Then it's the next player's turn. If he chooses DECLINE, he doesn't need to discard any card, and the card stays in the previous player's PASSED pile; current player draw a new card from center, and continue the game.

* When a three of a kind or four of a kind or any of the DRAGON or SNAKE actions are triggered, the turn goes to the player triggering the action, no matter who is drawing the card.

* when a player has full melds in his hand and exposed section, he can potentially declare HARMONY by taking a drawing card, or a PASSED card from previous player, to turn one CHI meld (either in his HAND or in EXPOSED section) into two KOUs, as long as other HARMONY declaring conditions are met.  In such case, HARMONY button should be enabled, along with PASS button. The player can choose either action.

* Passed cards are handled correctly:  namely if a player decide to pass on a freshly drew card,  the turn goes to the next player; that player first need to indicate if he choose or is forced to take this passed card, by a CHI or KOU action, or he can PASS.  If he choose CHI or KOU, then he take the card, and discard a card, and the turn goes to his next player.  If he choose to PASS, the turn stays with him, and he gets to draw a card from center pile, as usual. Specifically, when the second player choose PASS for the first player's PASSED card, the card stays in the first player's PASSED section.

* When a player form a CHI with a KOU in the EXPOSED section, instead of adding the new card as a single card CHI meld, the KOU and new card should be merged to form a CHI meld in the exposed section. This would be simiarly true, if a player takes a new card and turn HALF-DRAGON or HALF-SNAKE into DRAGON or SNAKE respectively.

# Testing:
a) there should be unit test of the scoring rules: i.e. scoring different combinations of 16 cards of well formed melds.