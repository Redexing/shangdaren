
import { Deck } from './deck.js';
import { Player } from './player.js';
import { Rules } from './rules.js';
import { getFreshSeed } from './utils.js';
import { GAME_SPEEDS } from './constants.js';

export const EVENTS = {
    STATE_CHANGE: 'state_change',
    LOG: 'log',
    GAME_OVER: 'game_over'
};

export class Game {
    constructor() {
        console.log("[GAME] Constructor starting...");
        this.deck = new Deck();
        this.players = [];
        this.currentPlayerIndex = 0;
        this.turnPhase = 'INIT'; // INIT, DRAWN, DISCARDED
        this.activeCard = null; // The card currently in play (being drawn or discarded)
        this.activeCardSource = null; // 'DECK' or playerIndex
        this.listeners = {};
        this.kousOnTable = []; // Array of { playerIndex, cards: [c1, c2], suiteIndex }

        // Settings
        this.autoPlay = false;
        this.isWatchMode = false; // All 3 bots
        this.autoPlayDelay = GAME_SPEEDS.AUTO_PLAY_DELAY;

        this.drawnCardId = null; // Track the ID of the card just drawn
        this.pendingActions = new Map();
        this.highlightedCards = []; // Array of Card objects to highlight
        this.declinedPlayers = new Set(); // Track who has declined the current active card
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    log(msg) {
        console.log(msg);
        this.emit(EVENTS.LOG, msg);
    }

    init(watchMode = false) {
        // Create deck with a completely fresh seeded PRNG instance
        this.deck = new Deck(getFreshSeed());

        this.isWatchMode = watchMode;
        // ... rest of init ...
        // Reset state
        this.highlightedCards = [];
        this.pendingActions = new Map();
        this.activeCard = null;
        this.drawnCardId = null;
        this.declinedPlayers.clear();

        if (watchMode) {
            this.players = [
                new Player("Bot 1", false),
                new Player("Bot 2", false),
                new Player("Bot 3", false)
            ];
        } else {
            this.players = [
                new Player("You", true),
                new Player("Bot Left"),
                new Player("Bot Right")
            ];
        }

        // Shuffle & Deal using the deck's own draw method
        for (let i = 0; i < 15; i++) {
            this.players.forEach(p => p.draw(this.deck.draw()));
        }

        // Random Start
        this.currentPlayerIndex = Math.floor(Math.random() * 3);
        this.log(`Game started. ${this.players[this.currentPlayerIndex].name} goes first.`);

        this.startTurn();
    }

    startTurn() {
        this.turnPhase = 'DRAWING';
        this.emit(EVENTS.STATE_CHANGE);

        // Respect autoPlayDelay for bots/watch mode
        const delay = this.isWatchMode ? this.autoPlayDelay : GAME_SPEEDS.TURN_START_DELAY;
        setTimeout(() => this.drawCard(), delay);
    }

    drawCard() {
        if (this.deck.isEmpty()) {
            this.log("Deck empty. Draw game.");
            this.endGame({ winner: null });
            return;
        }

        const card = this.deck.draw();
        this.activeCard = card;
        this.drawnCardId = card.id; // Track drawn card
        this.activeCardSource = 'DECK';
        this.declinedPlayers.clear(); // Important: reset for new card
        this.log(`${this.getCurrentPlayer().name} drew ${card.toString()}`);

        // Pause briefly so user can see it in center discard
        this.emit(EVENTS.STATE_CHANGE);

        const delay = (this.isWatchMode || !this.players[this.currentPlayerIndex].isHuman) ? GAME_SPEEDS.BOT_DRAW_INTERNAL_DELAY : 0;
        setTimeout(() => {
            // Check Actions
            this.handleDrawActions(card);
        }, delay);
    }

    checkInterrupts(card, isDraw) {
        // Deprecated by new Action Logic
        return false;
    }

    calculateActions(card) {
        // Check actions for Current Player (Drawer)
        const currentP = this.getCurrentPlayer();
        const currentActions = Rules.getActions(currentP.hand, card, true, currentP.exposed, currentP.discards);

        // Check Harmony for Drawer
        if (Rules.canDeclareHarmony(currentP.hand, currentP.exposed, card)) {
            currentActions.push({ type: 'HARMONY', cards: [] });
        }

        // Add PASS for Drawer
        currentActions.push({ type: 'PASS', cards: [] });

        // Check actions for Others (Interrupts)
        const allActions = new Map();

        // Drawer Actions
        if (currentActions.length > 0) {
            allActions.set(this.currentPlayerIndex, currentActions);
        }

        // Others (PENG/SAO)
        for (let i = 1; i < 3; i++) {
            const idx = (this.currentPlayerIndex + i) % 3;
            const p = this.players[idx];
            const moves = Rules.getActions(p.hand, card, false, p.exposed, p.discards);

            // Rule 8: Interrupting with Harmony
            if (Rules.canDeclareHarmony(p.hand, p.exposed, card)) {
                moves.push({ type: 'HARMONY', cards: [] });
            }

            if (moves.length > 0) {
                allActions.set(idx, moves);
            }
        }

        return allActions;
    }

    // Process actions after Draw
    handleDrawActions(card) {
        const actionMap = this.calculateActions(card);
        this.pendingActions = actionMap;

        const humanIdx = this.players.findIndex(p => p.isHuman);
        const humanActions = actionMap.get(humanIdx) || [];

        // Rule 2: Always wait for Human to see and "Decline" or Action if not in watch mode
        if (!this.isWatchMode && humanIdx !== -1) {
            // Ensure PASS is always available for human if it's not already there
            if (!humanActions.find(a => a.type === 'PASS')) {
                humanActions.push({ type: 'PASS', cards: [] });
                actionMap.set(humanIdx, humanActions);
            }
            this.turnPhase = 'DECISION_WAIT';
            this.emit(EVENTS.STATE_CHANGE);
        } else {
            this.resolveBotActions(card, actionMap);
        }
    }

    resolveBotActions(card, actionMap) {
        // Naive resolution: Check Interrupts first.
        let handled = false;
        for (let i = 1; i < 3; i++) {
            const idx = (this.currentPlayerIndex + i) % 3;
            if (this.declinedPlayers.has(idx)) continue; // Skip those who declined

            const player = this.players[idx];
            // If it's a human interrupter and we are NOT in watch mode, we MUST wait.
            // But handleDrawActions already sets DECISION_WAIT if humanIdx has actions.
            // If we are here, it means we are either in watch mode OR human has already declined or has no SAO/PENG.

            const moves = actionMap.get(idx);
            if (moves && moves.length > 0) {
                // Check Harmony first
                const win = moves.find(m => m.type === 'HARMONY');
                if (win && (!player.isHuman || this.isWatchMode)) {
                    this.handleHarmony(idx, card);
                    handled = true;
                    break;
                }

                const meld = moves.find(m => ['SAO', 'PENG', 'XIA-CE', 'KAI-ZAO', 'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE'].includes(m.type));
                if (meld && (!player.isHuman || this.isWatchMode)) {
                    this.log(`${player.name} interrupts with ${meld.type}!`);
                    this.executeBotMeld(idx, card, meld);
                    handled = true;
                    break;
                }
            }
        }

        if (!handled) {
            // Drawer Action
            const dIdx = this.currentPlayerIndex;
            if (this.declinedPlayers.has(dIdx)) {
                // This shouldn't happen usually but for safety
                this.log("Drawer already declined. Moving to pass flow.");
                this.handlePass(dIdx, card);
                return;
            }

            const drawerMoves = actionMap.get(dIdx);
            const player = this.players[dIdx];

            if (drawerMoves) {
                // If drawer is human and NOT watch mode, they should have been handled by DECISION_WAIT.
                // If we are here and drawer is human, it means they clicked something or we are in watch mode.
                if (player.isHuman && !this.isWatchMode && this.turnPhase === 'DRAWING') {
                    // Safety: if phase hasn't changed to decision wait, something is wrong.
                    this.turnPhase = 'DECISION_WAIT';
                    this.emit(EVENTS.STATE_CHANGE);
                    return;
                }

                // Bot Logic for Drawer
                if (!player.isHuman || this.isWatchMode) {
                    const win = drawerMoves.find(m => m.type === 'HARMONY');
                    if (win) {
                        this.handleHarmony(dIdx, card);
                        return;
                    }

                    const mustMove = drawerMoves.find(m => ['SAO', 'PENG', 'CHI', 'XIA-CE', 'KAI-ZAO', 'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE'].includes(m.type));
                    const kouMove = drawerMoves.find(m => m.type === 'KOU');

                    if (mustMove) {
                        this.executeBotMeld(dIdx, card, mustMove);
                    } else if (kouMove && (this.isWatchMode || Math.random() > 0.3)) {
                        this.executeBotMeld(dIdx, card, kouMove);
                    } else {
                        this.handlePass(dIdx, card);
                    }
                }
            } else {
                // No moves at all? Pass.
                this.handlePass(dIdx, card);
            }
        }
    }

    handlePass(playerIndex, card) {
        const p = this.players[playerIndex];
        const isDrawer = (playerIndex === this.currentPlayerIndex);

        // Track this player's decline for the current active card
        this.declinedPlayers.add(playerIndex);

        if (isDrawer) {
            if (this.activeCardSource === 'DECK') {
                // Case 1: Drawer passes a freshly drawn card
                this.log(`${p.name} PASS (Passed) ${card.toString()}`);
                p.addToDiscards(card, true); // Added to passed pile for now

                // Highlight
                this.highlightedCards = [card];
                this.activeCardSource = playerIndex;
                this.turnPhase = 'ANIMATING';
                this.emit(EVENTS.STATE_CHANGE);

                setTimeout(() => {
                    this.highlightedCards = [];
                    const nextIdx = (playerIndex + 1) % 3;
                    const nextP = this.players[nextIdx];
                    const actions = Rules.getActions(nextP.hand, card, true, nextP.exposed, nextP.discards);

                    // Rule 8: Harmony from passed
                    if (Rules.canDeclareHarmony(nextP.hand, nextP.exposed, card)) {
                        if (!actions.find(a => a.type === 'HARMONY')) actions.push({ type: 'HARMONY', cards: [] });
                    }

                    // Mandatory CHI check
                    const chiAction = actions.find(a => a.type === 'CHI');
                    if (chiAction) {
                        this.log(`Mandatory CHI for ${nextP.name}!`);
                        const finalActions = actions.filter(a => a.type === 'CHI' || a.type === 'HARMONY');
                        this.currentPlayerIndex = nextIdx;
                        this.activeCard = card;
                        this.pendingActions = new Map([[nextIdx, finalActions]]);
                    } else {
                        if (!actions.find(a => a.type === 'PASS')) {
                            actions.push({ type: 'PASS', cards: [] });
                        }
                        this.currentPlayerIndex = nextIdx;
                        this.activeCard = card;
                        this.pendingActions = new Map([[nextIdx, actions]]);
                    }

                    if (!nextP.isHuman || this.isWatchMode) {
                        // Emit STATE_CHANGE so the carousel can scroll to nextIdx
                        // and the user sees the receiving player before they act.
                        this.turnPhase = 'DRAWING';
                        this.emit(EVENTS.STATE_CHANGE);
                        setTimeout(() => {
                            this.resolvePassedBotActions(nextIdx, card, this.pendingActions.get(nextIdx));
                        }, GAME_SPEEDS.PASS_ACTION_DELAY);
                    } else {
                        this.turnPhase = 'DECISION_WAIT';
                        this.emit(EVENTS.STATE_CHANGE);
                    }
                }, GAME_SPEEDS.PASS_ACTION_DELAY);
            } else {
                // Case 2: Player declines a card passed to them (Secondary Pass)
                this.log(`${p.name} declined passed card. Now draws from deck.`);

                // Brief pause to show it in the center before it's gone
                this.turnPhase = 'ANIMATING';
                this.highlightedCards = [card];
                this.activeCard = card; // Ensure it's still in the center
                this.emit(EVENTS.STATE_CHANGE);

                setTimeout(() => {
                    this.activeCard = null;
                    this.highlightedCards = [];
                    this.drawnCardId = null;
                    this.startTurn();
                }, GAME_SPEEDS.PASS_ACTION_DELAY);
            }
        } else {
            // Interrupt PASS (Decline)
            this.log(`${p.name} declines interrupt.`);
            this.resolveBotActions(card, this.pendingActions);
        }
    }

    resolvePassedBotActions(playerIndex, card, actions) {
        // Rule e.2 / Rule 8 for bots
        const win = actions.find(a => a.type === 'HARMONY');
        if (win) {
            this.handleHarmony(playerIndex, card);
            return;
        }

        const chi = actions.find(a => a.type === 'CHI');
        if (chi) {
            this.executeBotMeld(playerIndex, card, chi);
            return;
        }

        const kou = actions.find(a => a.type === 'KOU');
        if (kou && Math.random() > 0.3) {
            this.executeBotMeld(playerIndex, card, kou);
        } else {
            // Decline -> Use unified handlePass logic
            this.handlePass(playerIndex, card);
        }
    }

    handleHarmony(playerIndex, card) {
        const p = this.players[playerIndex];
        this.log(`${p.name} declares HARMONY!`);

        // Finalize state: Add all cards to exposed for visualization
        const allCards = [...p.hand];
        if (card) allCards.push(card);
        p.exposed.forEach(m => allCards.push(...m.cards));

        const partition = Rules.findPerfectPartition(allCards);
        if (partition) {
            p.exposed = partition;
            p.hand = [];
        }

        this.highlightedCards = [card];
        this.activeCard = null;
        this.emit(EVENTS.STATE_CHANGE);

        setTimeout(() => {
            this.endGame({ winner: p });
        }, GAME_SPEEDS.HARMONY_CELEBRATION);
    }

    executeBotMeld(playerIndex, card, action) {
        // Bot automatically discards random card after meld (unless SAO)
        // 1. Meld
        const player = this.players[playerIndex];

        const highlighted = [];

        if (action.meldRef) {
            const meld = action.meldRef;
            if (meld && card) {
                const oldType = meld.type;
                meld.type = action.type; // Upgrade type (e.g., CHI or DRAGON)
                meld.cards.push(card);
                meld.cards.sort((a, b) => a.characterIndex - b.characterIndex);
                highlighted.push(card, ...meld.cards);
                this.log(`${player.name} upgraded ${oldType} into ${action.type} with ${card.toString()}`);
                this.emit('ACTION_ANNOUNCE', { playerIndex, type: action.type });
            }
        } else {
            const meldCards = [...action.cards, card];
            // Remove from hand
            action.cards.forEach(c => {
                const idx = player.hand.findIndex(hc => hc.id === c.id);
                if (idx !== -1) player.hand.splice(idx, 1);
            });
            // Add Exposed
            player.exposed.push({ type: action.type, cards: meldCards });
            this.log(`${player.name} performs ${action.type}`);
            this.emit('ACTION_ANNOUNCE', { playerIndex, type: action.type });
            highlighted.push(...meldCards);

            // Rule 6 removal
            if (this.activeCardSource !== null && this.activeCardSource !== 'DECK' && this.activeCardSource !== playerIndex) {
                const prevP = this.players[this.activeCardSource];
                prevP.removePassedCard(card);
            }
        }

        // Check Harmony
        if (this.checkHarmony(player)) {
            this.log(`${player.name} declares HARMONY!`);
            this.endGame({ winner: player });
            return;
        }

        // 2. Discard (if not KAI-ZAO/XIA-CE/DRAGON/SNAKE etc)
        const skipDiscard = ['KAI-ZAO', 'XIA-CE'].includes(action.type);

        if (!skipDiscard) {
            if (player.hand.length === 0) {
                this.log(`${player.name} is BAO-ZI! (No cards to discard)`);
                this.endGame({ winner: null, special: 'BAO-ZI', triggerPlayer: player });
                return;
            }

            let disIdx = -1;
            for (let i = 0; i < player.hand.length; i++) {
                if (Rules.canDiscard(player.hand, i)) {
                    disIdx = i;
                    break;
                }
            }
            if (disIdx === -1) disIdx = 0;

            const disCard = player.discard(disIdx);
            player.addToDiscards(disCard, false);
            this.log(`${player.name} discarded ${disCard.toString()}`);
            highlighted.push(disCard);
        }

        // Immediately clear center-discard div so the discarded card only shows in player's pile
        this.activeCard = null;

        // Keep highlight for the duration of the animation highlighting so it stays in center briefly
        this.highlightedCards = highlighted;
        this.turnPhase = 'ANIMATING';
        this.emit(EVENTS.STATE_CHANGE);

        setTimeout(() => {
            this.highlightedCards = [];
            // Reset to whoever melded, and THEN advance turn
            this.currentPlayerIndex = playerIndex;
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
            this.startTurn();
        }, GAME_SPEEDS.BOT_MELD_HIGHLIGHT);
    }

    // For Human: Called when button clicked
    selectAction(actionType) {
        // Validate with pendingActions
        // Logic handled in UI flow: Select Action -> Enters "SELECT_DISCARD" mode if needed
        // Here we just validate availability?
        return true;
    }

    // For Human: Called when discard card selected after Action chosen
    confirmHumanMeld(action, discardCardIndex = -1) {
        const humanIdx = this.players.findIndex(ply => ply.isHuman);
        const p = this.players[humanIdx];

        // Validate discard index first
        const skipDiscard = ['KAI-ZAO', 'XIA-CE'].includes(action.type);
        let discardCard = null;

        if (!skipDiscard) {
            if (discardCardIndex === -1) {
                console.error("Discard required for " + action.type);
                return;
            }
            discardCard = p.hand[discardCardIndex];
        } else {
            discardCard = null; // These types don't require discard
        }

        // Highlight logic
        const involved = [...action.cards];
        if (action.meldRef) {
            involved.push(...action.meldRef.cards);
        }
        if (discardCard) involved.push(discardCard);
        if (this.activeCard) involved.push(this.activeCard);

        this.highlightedCards = involved;
        this.turnPhase = 'ANIMATING'; // Freeze
        this.emit(EVENTS.STATE_CHANGE);

        setTimeout(() => {
            this.finalizeConfirmHumanMeld(p, action, discardCard, humanIdx);
        }, GAME_SPEEDS.HUMAN_MELD_HIGHLIGHT);
    }

    finalizeConfirmHumanMeld(p, action, discardCard, humanIdx) {
        const meldCard = this.activeCard;
        if (action.meldRef) {
            const meld = action.meldRef;
            if (meld && meldCard) {
                meld.type = action.type;
                meld.cards.push(meldCard);
                meld.cards.sort((a, b) => a.characterIndex - b.characterIndex);

                // Rule 6 removal
                if (this.activeCardSource !== null && this.activeCardSource !== 'DECK' && this.activeCardSource !== humanIdx) {
                    const prevP = this.players[this.activeCardSource];
                    prevP.removePassedCard(meldCard);
                }
                this.emit('ACTION_ANNOUNCE', { playerIndex: humanIdx, type: action.type });
            }
        } else {
            const meldCards = [...action.cards, meldCard];
            action.cards.forEach(c => {
                const idx = p.hand.findIndex(hc => hc.id === c.id);
                if (idx !== -1) p.hand.splice(idx, 1);
            });
            p.exposed.push({ type: action.type, cards: meldCards });
            this.emit('ACTION_ANNOUNCE', { playerIndex: humanIdx, type: action.type });

            // Rule 6 removal
            if (this.activeCardSource !== null && this.activeCardSource !== 'DECK' && this.activeCardSource !== humanIdx) {
                const prevP = this.players[this.activeCardSource];
                prevP.removePassedCard(meldCard);
            }
        }

        this.activeCard = null;

        // Check Harmony
        if (this.checkHarmony(p)) {
            this.log(`${p.name} declares HARMONY!`);
            this.endGame({ winner: p });
            return;
        }

        const skipDiscard = ['KAI-ZAO', 'XIA-CE'].includes(action.type);

        // 2. Discard
        if (!skipDiscard) {
            if (p.hand.length === 0) {
                this.log(`${p.name} is BAO-ZI! (No cards to discard)`);
                this.endGame({ winner: null, special: 'BAO-ZI', triggerPlayer: p });
                return;
            }
            if (discardCard) {
                const dIdx = p.hand.findIndex(c => c.id === discardCard.id);
                if (dIdx !== -1) {
                    const dCard = p.discard(dIdx);
                    p.addToDiscards(dCard, false);
                    this.log(`${p.name} discarded ${dCard.toString()}`);
                }
            }
        }

        this.highlightedCards = [];
        this.currentPlayerIndex = humanIdx;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
        this.startTurn();
    }

    executeMeld(playerIndex, card, type) {
        const player = this.players[playerIndex];

        // Note: card is from Center/Deck. Not in hand yet.
        // Remove matching cards from hand
        const sameCards = player.hand.filter(c => c.typeId === card.typeId);

        // Remove from hand
        player.hand = player.hand.filter(c => c.typeId !== card.typeId);

        // Add meld to exposed
        const meldCards = [...sameCards, card];
        player.exposed.push({ type, cards: meldCards });


        this.log(`${player.name} formed ${type} with ${card.toString()}`);

        // Turn moves to this player
        this.currentPlayerIndex = playerIndex;
        this.activeCard = null;
        this.drawnCardId = null; // Melded, so not "drawn & unneeded" anymore

        // Player must now Discard (unless Win?)
        this.turnPhase = 'DISCARD_WAIT';
        this.emit(EVENTS.STATE_CHANGE);

        if (!player.isHuman || this.isWatchMode) {
            setTimeout(() => this.botDiscard(player), this.autoPlayDelay);
        }
    }

    handlePlayerDiscard(cardIndex) {
        const p = this.getCurrentPlayer();
        // Resolve card immediately to avoid index issues if hand changes (though shouldn't here)
        const card = p.hand[cardIndex];

        // Highlight logic
        this.highlightedCards = [card];
        this.turnPhase = 'ANIMATING'; // Freeze UI
        this.emit(EVENTS.STATE_CHANGE);

        setTimeout(() => {
            this.finalizeDiscard(p, card);
        }, GAME_SPEEDS.DISCARD_HIGHLIGHT);
    }

    finalizeDiscard(p, card) {
        // Now remove from hand using instance
        // p.discard(idx) relies on index. 
        // Safer: p.discardCard(card)
        // Or find index again.
        const idx = p.hand.findIndex(c => c.id === card.id);
        if (idx !== -1) {
            p.discard(idx);
        } else {
            console.error("Card not found in hand during finalizeDiscard");
            return;
        }

        // Determine pile
        const wasJustDrawn = (card.id === this.drawnCardId);
        p.addToDiscards(card, wasJustDrawn);

        this.activeCard = card;
        this.drawnCardId = null; // Reset
        this.activeCardSource = this.currentPlayerIndex;
        this.log(`${p.name} ${wasJustDrawn ? 'rejected (passed)' : 'discarded'} ${card.toString()}`);

        this.highlightedCards = []; // Reset highlight

        // Check KOU completion (mandatory)
        const nextIdx = (this.currentPlayerIndex + 1) % 3;
        const nextPlayer = this.players[nextIdx];

        // Existing KOU completion logic...
        const kous = nextPlayer.exposed.filter(m => m.type === 'KOU');
        let kouMatch = null;
        for (const k of kous) {
            if (Rules.canCompleteKou(k.cards, card)) {
                kouMatch = k;
                break;
            }
        }

        if (kouMatch) {
            this.log(`${nextPlayer.name} has KOU match! Must take ${card.toString()}`);
            kouMatch.type = 'SUITE';
            kouMatch.cards.push(card);

            this.currentPlayerIndex = nextIdx;
            this.activeCard = null;
            this.turnPhase = 'DISCARD_WAIT';
            this.emit(EVENTS.STATE_CHANGE);

            if (!nextPlayer.isHuman || this.isWatchMode) setTimeout(() => this.botDiscard(nextPlayer), this.autoPlayDelay);
            return;
        }

        // If no mandatory interrupt, allow next player to FORM KOU (Optional) from discard?
        // For simplicity: We only allow forming KOU from Drawn card in this version.
        // Or implement optional interrupt here if needed.

        // Turn passes to next player
        this.currentPlayerIndex = nextIdx;

        // Immediately clear center-discard div so the discarded card only shows in player's pile
        this.activeCard = null;

        // Brief pause to SHOW the highlighting on the new cards
        this.turnPhase = 'ANIMATING';
        this.highlightedCards = [card];
        this.emit(EVENTS.STATE_CHANGE);

        setTimeout(() => {
            this.highlightedCards = [];
            this.startTurn();
        }, GAME_SPEEDS.NEXT_TURN_DELAY);
    }

    formKou(cardIndex) {
        // Player wants to form KOU from Drawn Card using a card from Hand at cardIndex
        const p = this.getCurrentPlayer();
        const handCard = p.hand[cardIndex];
        const drawnCard = this.activeCard; // Assuming we are in DRAW_WAIT/ACTION_WAIT and activeCard is the drawn one?

        // Validate
        // Hand card must match Drawn card suite but diff char
        if (handCard.suiteIndex !== drawnCard.suiteIndex || handCard.characterIndex === drawnCard.characterIndex) {
            this.log("Invalid KOU formation");
            return false;
        }

        // Remove hand card
        p.hand.splice(cardIndex, 1);

        // Add KOU to exposed
        p.exposed.push({ type: 'KOU', cards: [handCard, drawnCard] });
        this.log(`${p.name} formed KOU with ${drawnCard.toString()} and ${handCard.toString()}`);

        // Drawn card is consumed
        this.activeCard = null;

        // Now player must discard
        this.turnPhase = 'DISCARD_WAIT';
        this.emit(EVENTS.STATE_CHANGE);
        return true;
    }

    // Simple bot logic
    botAction(player, card) {
        // Logic: 
        // 1. Can form KOU? Randomly decide to do it (50%)
        // 2. Else Keep if useful? (Simplification: Always keep and discard worst)
        // 3. Else Discard immediately (if drawn card is worst)

        // For now: Always take card into hand, then discard worst.
        player.draw(card);
        this.botDiscard(player);
    }

    botDiscard(player) {
        // Discard specific logic
        // Random for now
        const idx = Math.floor(Math.random() * player.hand.length);
        this.handlePlayerDiscard(idx);
    }

    checkHarmony(player) {
        return Rules.canDeclareHarmony(player.hand, player.exposed, null);
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    endGame(result) {
        // result is { winner: Player (if win), special: 'BAO-ZI' (if Baozi), triggerPlayer: Player (if Baozi) }

        // 1. All players increment totalGames
        this.players.forEach(p => {
            p.totalGames++;
        });

        // 2. Determine who won based on the result
        if (result.special === 'BAO-ZI') {
            // Everyone wins except the triangle player (triggerPlayer)
            this.players.forEach(p => {
                if (p.name !== result.triggerPlayer.name) {
                    p.wins++;
                }
            });
        } else if (result.winner) {
            // A specific winner
            this.players.forEach(p => {
                if (p.name === result.winner.name) {
                    p.wins++;
                }
            });
        }
        // If result.winner is null and result.special is not BAO-ZI, it's a draw (no wins incremented).

        // 3. Save stats for all players
        this.players.forEach(p => p.saveStats());

        // 4. Emit the event
        this.emit(EVENTS.GAME_OVER, result);
    }
}
