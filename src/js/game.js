
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
        this.flowToken = 0; // Invalidates timers from a previous game or turn branch
    }

    // Only the newest follow-up runs. A new game, or a later step, cancels timers
    // still pending from an earlier game so they cannot meld the wrong card.
    scheduleFlow(delay, fn) {
        const token = ++this.flowToken;
        setTimeout(() => {
            if (token !== this.flowToken) return;
            fn();
        }, delay);
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
        // Drop timers from the previous game before any new turn is scheduled.
        this.flowToken++;

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
        this.scheduleFlow(delay, () => this.drawCard());
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
        this.scheduleFlow(delay, () => {
            this.handleDrawActions(card);
        });
    }

    checkInterrupts(card, isDraw) {
        // Deprecated by new Action Logic
        return false;
    }

    calculateActions(card) {
        const interruptTypes = new Set([
            'HARMONY', 'PENG', 'SAO', 'XIA-CE', 'KAI-ZAO',
            'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE', 'TWO-DRAGONS-TUSSLING'
        ]);

        const allActions = new Map();
        const currentP = this.getCurrentPlayer();
        const drawerSelfDraw = this.isSelfDrawFor(this.currentPlayerIndex);
        const currentActions = Rules.getActions(
            currentP.hand, card, true, currentP.exposed, currentP.discards,
            this.kouHistoryOptions(this.currentPlayerIndex, drawerSelfDraw)
        );
        this.ensureHarmonyAction(currentActions, currentP, card, drawerSelfDraw, true);
        this.applyPassPolicy(currentActions, this.currentPlayerIndex);
        allActions.set(this.currentPlayerIndex, currentActions);

        // Others may interrupt with Harmony, trips, or quads — not CHI/KOU.
        for (let i = 1; i < 3; i++) {
            const idx = (this.currentPlayerIndex + i) % 3;
            const p = this.players[idx];
            let moves = Rules.getActions(
                p.hand, card, false, p.exposed, p.discards,
                this.kouHistoryOptions(idx, false)
            );
            this.ensureHarmonyAction(moves, p, card, false, false);
            moves = moves.filter(m => interruptTypes.has(m.type));
            this.applyPassPolicy(moves, idx);
            if (moves.length > 0) {
                allActions.set(idx, moves);
            }
        }

        return allActions;
    }

    // Own passes and the upstream player's earlier passes close a suit for KOU.
    // The card currently offered is excluded inside Rules.isKouClosed.
    kouHistoryOptions(playerIndex, isSelfDraw) {
        const upstream = (playerIndex + 2) % 3;
        const player = this.players[playerIndex];
        const upstreamPlayer = this.players[upstream];
        return {
            isSelf: playerIndex === this.currentPlayerIndex,
            isSelfDraw,
            passedCards: player.passedCards || [],
            upstreamPassedCards: upstreamPlayer.passedCards || []
        };
    }

    // Self-draw means this player drew the completing card from the deck.
    // A card passed by someone else, or drawn by another player, is not a self-draw.
    isSelfDrawFor(playerIndex) {
        return this.activeCardSource === 'DECK' && this.currentPlayerIndex === playerIndex;
    }

    ensureHarmonyAction(actions, player, card, isSelfDraw, isSelf = isSelfDraw) {
        if (Rules.canDeclareHarmony(player.hand, player.exposed, card, { isSelfDraw, isSelf })
            && !actions.some(a => a.type === 'HARMONY')) {
            actions.push({ type: 'HARMONY', cards: [] });
        }
    }

    // Harmony is must-claim on a self-drawn tile or one from the upstream (right) player.
    // It is optional when the downstream (left) player draws it.
    isWinningTileMustClaim(playerIndex) {
        const upstream = (playerIndex + 2) % 3;
        if (this.activeCardSource === 'DECK' || this.activeCardSource === null) {
            return this.currentPlayerIndex === playerIndex || this.currentPlayerIndex === upstream;
        }
        return this.activeCardSource === playerIndex || this.activeCardSource === upstream;
    }

    applyPassPolicy(actions, playerIndex) {
        const mandatoryMeldTypes = [
            'SAO', 'PENG', 'CHI', 'KAI-ZAO', 'XIA-CE',
            'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE', 'TWO-DRAGONS-TUSSLING'
        ];
        const hasMandatoryMeld = actions.some(m => mandatoryMeldTypes.includes(m.type));
        const hasHarmony = actions.some(m => m.type === 'HARMONY');
        const harmonyMust = hasHarmony && this.isWinningTileMustClaim(playerIndex);

        for (let i = actions.length - 1; i >= 0; i--) {
            if (actions[i].type === 'PASS') actions.splice(i, 1);
        }

        if (!hasMandatoryMeld && !harmonyMust) {
            actions.push({ type: 'PASS', cards: [] });
        }
    }

    // Process actions after Draw
    handleDrawActions(card) {
        const actionMap = this.calculateActions(card);
        this.pendingActions = actionMap;

        const humanIdx = this.players.findIndex(p => p.isHuman);
        const humanActions = actionMap.get(humanIdx) || [];

        // Wait for the human to act or decline, but do not add PASS over a must-claim.
        if (!this.isWatchMode && humanIdx !== -1) {
            const mustClaim = humanActions.some(a => [
                'SAO', 'PENG', 'CHI', 'KAI-ZAO', 'XIA-CE',
                'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE', 'TWO-DRAGONS-TUSSLING'
            ].includes(a.type))
                || (humanActions.some(a => a.type === 'HARMONY') && this.isWinningTileMustClaim(humanIdx));

            if (!mustClaim && !humanActions.find(a => a.type === 'PASS')) {
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
        // [RULE-INTERRUPT-PRIORITY]
        // Priority 1: HARMONY claims (interrupters and drawer).
        for (const offset of [1, 2, 0]) {
            const idx = (this.currentPlayerIndex + offset) % 3;
            if (this.declinedPlayers.has(idx)) continue;

            const player = this.players[idx];
            const moves = actionMap.get(idx);
            if (moves && moves.length > 0) {
                const win = moves.find(m => m.type === 'HARMONY');
                if (win && (!player.isHuman || this.isWatchMode)) {
                    this.handleHarmony(idx, card);
                    return;
                }
            }
        }

        // Priority 2: Quad and Trip interrupt claims from other players.
        let handled = false;
        for (let i = 1; i < 3; i++) {
            const idx = (this.currentPlayerIndex + i) % 3;
            if (this.declinedPlayers.has(idx)) continue; // Skip those who declined

            const player = this.players[idx];
            const moves = actionMap.get(idx);
            if (moves && moves.length > 0) {
                const meld = moves.find(m => [
                    'SAO', 'PENG', 'XIA-CE', 'KAI-ZAO',
                    'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE', 'TWO-DRAGONS-TUSSLING'
                ].includes(m.type));
                if (meld && (!player.isHuman || this.isWatchMode)) {
                    this.log(`${player.name} interrupts with ${meld.type}!`);
                    this.executeBotMeld(idx, card, meld);
                    handled = true;
                    break;
                }
            }
        }

        if (!handled) {
            // Priority 3: Drawer Action
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

                    const mustMove = drawerMoves.find(m => [
                        'SAO', 'PENG', 'CHI', 'KAI-ZAO', 'XIA-CE',
                        'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE', 'TWO-DRAGONS-TUSSLING'
                    ].includes(m.type));
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

                this.scheduleFlow(GAME_SPEEDS.PASS_ACTION_DELAY, () => {
                    this.highlightedCards = [];
                    const nextIdx = (playerIndex + 1) % 3;
                    const nextP = this.players[nextIdx];
                    this.currentPlayerIndex = nextIdx;
                    this.activeCard = card;
                    const receiverActions = this.calculateActions(card).get(nextIdx) || [];
                    if (receiverActions.some(a => a.type === 'CHI')) {
                        this.log(`Mandatory CHI for ${nextP.name}!`);
                    }
                    this.pendingActions = new Map([[nextIdx, receiverActions]]);

                    if (!nextP.isHuman || this.isWatchMode) {
                        // Emit STATE_CHANGE so the carousel can scroll to nextIdx
                        // and the user sees the receiving player before they act.
                        this.turnPhase = 'DRAWING';
                        this.emit(EVENTS.STATE_CHANGE);
                        this.scheduleFlow(GAME_SPEEDS.PASS_ACTION_DELAY, () => {
                            this.resolvePassedBotActions(nextIdx, card, receiverActions);
                        });
                    } else {
                        this.turnPhase = 'DECISION_WAIT';
                        this.emit(EVENTS.STATE_CHANGE);
                    }
                });
            } else {
                // Case 2: Player declines a card passed to them (Secondary Pass)
                this.log(`${p.name} declined passed card. Now draws from deck.`);

                // Brief pause to show it in the center before it's gone
                this.turnPhase = 'ANIMATING';
                this.highlightedCards = [card];
                this.activeCard = card; // Ensure it's still in the center
                this.emit(EVENTS.STATE_CHANGE);

                this.scheduleFlow(GAME_SPEEDS.PASS_ACTION_DELAY, () => {
                    this.activeCard = null;
                    this.highlightedCards = [];
                    this.drawnCardId = null;
                    this.startTurn();
                });
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
        const isSelfDraw = this.isSelfDrawFor(playerIndex);
        const isSelf = playerIndex === this.currentPlayerIndex;
        const reward = Rules.calculateRewards(p.hand, p.exposed, card, { isSelfDraw, isSelf });
        this.logHarmony(p, reward);

        // [RULE-PASSED-RECLAMATION]: Remove claimed card from passer's passedCards pile
        if (card && this.activeCardSource !== null && this.activeCardSource !== 'DECK' && this.activeCardSource !== playerIndex) {
            const prevP = this.players[this.activeCardSource];
            if (prevP) prevP.removePassedCard(card);
        }

        // Finalize state: Add all cards to exposed for visualization
        const assessed = Rules.assessHarmony(p.hand, p.exposed, card, { isSelfDraw, isSelf });
        if (assessed && assessed.partition) {
            p.exposed = assessed.partition;
            p.hand = [];
        }

        this.highlightedCards = card ? [card] : [];
        this.activeCard = null;
        this.emit(EVENTS.STATE_CHANGE);

        this.scheduleFlow(GAME_SPEEDS.HARMONY_CELEBRATION, () => {
            this.endGame({ winner: p, rewards: reward.total });
        });
    }

    revealNakedQuadIfPresent(player, highlighted = []) {
        const nakedQuad = Rules.findNakedQuadInHand(player.hand);
        if (!nakedQuad) return false;
        nakedQuad.forEach(c => {
            const idx = player.hand.findIndex(hc => hc.id === c.id);
            if (idx !== -1) player.hand.splice(idx, 1);
        });
        player.exposed.push({ type: 'KAI-ZAO', cards: nakedQuad });
        highlighted.push(...nakedQuad);
        this.log(`${player.name} revealed naked 4-of-a-kind (${nakedQuad[0].toString()}) in EXPOSED and skipped discard`);
        return true;
    }

    executeBotMeld(playerIndex, card, action) {
        // Bot automatically discards random card after meld (unless quad)
        // 1. Meld
        const player = this.players[playerIndex];

        const highlighted = [];

        if (!card) return;
        if (player.exposed.some(m => m.cards.some(c => c.id === card.id))) {
            this.log(`Ignored repeat of ${card.toString()}`);
            return;
        }
        if (action.meldRef && !Rules.isLegalMeldUpgrade(action.meldRef, card, action.type, action.cards || [], action.mergeMeldRef || null)) {
            this.log(`Ignored illegal ${action.type} with ${card.toString()}`);
            return;
        }

        if (action.meldRef) {
            const meld = action.meldRef;
            if (meld && card) {
                const oldType = meld.type;
                // Remove any extra hand cards attached to this upgrade (e.g., SAO -> HALF-DRAGON / DRAGON)
                (action.cards || []).forEach(c => {
                    const idx = player.hand.findIndex(hc => hc.id === c.id);
                    if (idx !== -1) player.hand.splice(idx, 1);
                    meld.cards.push(c);
                });
                // Merge secondary exposed meld if present (e.g., SAO + KOU -> DRAGON, HALF-DRAGON + SAO -> TWO-DRAGONS-TUSSLING)
                if (action.mergeMeldRef) {
                    const mergeIdx = player.exposed.indexOf(action.mergeMeldRef);
                    if (mergeIdx !== -1) player.exposed.splice(mergeIdx, 1);
                    meld.cards.push(...action.mergeMeldRef.cards);
                }
                if (action.quadTypes) {
                    meld.quadTypes = action.quadTypes;
                }
                meld.type = action.type; // Upgrade type (e.g., CHI or DRAGON)
                meld.cards.push(card);
                meld.cards.sort((a, b) => a.characterIndex - b.characterIndex);
                highlighted.push(card, ...meld.cards);
                this.log(`${player.name} upgraded ${oldType} into ${action.type} with ${card.toString()}`);
                this.emit('ACTION_ANNOUNCE', { playerIndex, type: action.type });

                // [RULE-PASSED-RECLAMATION]
                if (this.activeCardSource !== null && this.activeCardSource !== 'DECK' && this.activeCardSource !== playerIndex) {
                    const prevP = this.players[this.activeCardSource];
                    if (prevP) prevP.removePassedCard(card);
                }
            }
        } else {
            const meldCards = [...action.cards, card];
            // Remove from hand
            action.cards.forEach(c => {
                const idx = player.hand.findIndex(hc => hc.id === c.id);
                if (idx !== -1) player.hand.splice(idx, 1);
            });
            // Add Exposed
            const newMeld = { type: action.type, cards: meldCards };
            if (action.quadTypes) newMeld.quadTypes = action.quadTypes;
            player.exposed.push(newMeld);
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
        if (this.finishHarmonyIfWon(player)) return;

        // 2. Discard (if not KAI-ZAO/XIA-CE)
        const skipDiscard = ['KAI-ZAO', 'XIA-CE'].includes(action.type);

        if (!skipDiscard) {
            // [RULE-NAKED-QUAD-REVEAL]: If player holds a naked 4-of-a-kind in hand, reveal it and skip discard
            if (this.revealNakedQuadIfPresent(player, highlighted)) {
                if (this.finishHarmonyIfWon(player)) return;
            } else {
                if (this.declareBaoziIfNoLegalDiscard(player)) return;

                const disIdx = Rules.firstLegalDiscardIndex(player.hand);
                const disCard = player.discard(disIdx);
                player.addToDiscards(disCard, false);
                this.log(`${player.name} discarded ${disCard.toString()}`);
                highlighted.push(disCard);
            }
        }

        // Immediately clear center-discard div so the discarded card only shows in player's pile
        this.activeCard = null;

        // Keep highlight for the duration of the animation highlighting so it stays in center briefly
        this.highlightedCards = highlighted;
        this.turnPhase = 'ANIMATING';
        this.emit(EVENTS.STATE_CHANGE);

        this.scheduleFlow(GAME_SPEEDS.BOT_MELD_HIGHLIGHT, () => {
            this.highlightedCards = [];
            // Reset to whoever melded, and THEN advance turn
            this.currentPlayerIndex = playerIndex;
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
            this.startTurn();
        });
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
            const prospective = this.handAfterMeldClaim(p.hand, action);
            const hasNakedQuad = Boolean(Rules.findNakedQuadInHand(prospective));
            if (hasNakedQuad || Rules.firstLegalDiscardIndex(prospective) === -1) {
                discardCard = null;
            } else if (discardCardIndex === -1 || !p.hand[discardCardIndex]) {
                console.error("Discard required for " + action.type);
                return;
            } else {
                const candidate = p.hand[discardCardIndex];
                if ((action.cards || []).some(c => c.id === candidate.id)) {
                    console.error("Cannot discard a card that is part of the meld being formed");
                    return;
                }
                const prospectiveIdx = prospective.findIndex(c => c.id === candidate.id);
                if (prospectiveIdx === -1 || !Rules.canDiscard(prospective, prospectiveIdx)) {
                    console.error("Selected card cannot be legally discarded");
                    return;
                }
                discardCard = candidate;
            }
        } else {
            discardCard = null; // These types don't require discard
        }

        // Highlight logic
        const involved = [...(action.cards || [])];
        if (action.meldRef) {
            involved.push(...action.meldRef.cards);
        }
        if (action.mergeMeldRef) {
            involved.push(...action.mergeMeldRef.cards);
        }
        if (discardCard) involved.push(discardCard);
        if (this.activeCard) involved.push(this.activeCard);

        this.highlightedCards = involved;
        this.turnPhase = 'ANIMATING'; // Freeze
        this.emit(EVENTS.STATE_CHANGE);

        this.scheduleFlow(GAME_SPEEDS.HUMAN_MELD_HIGHLIGHT, () => {
            this.finalizeConfirmHumanMeld(p, action, discardCard, humanIdx);
        });
    }

    finalizeConfirmHumanMeld(p, action, discardCard, humanIdx) {
        const meldCard = this.activeCard;
        if (meldCard && p.exposed.some(m => m.cards.some(c => c.id === meldCard.id))) {
            this.log(`Ignored repeat of ${meldCard.toString()}`);
            return;
        }
        if (action.meldRef && !Rules.isLegalMeldUpgrade(action.meldRef, meldCard, action.type, action.cards || [], action.mergeMeldRef || null)) {
            this.log(`Ignored illegal ${action.type} with ${meldCard ? meldCard.toString() : 'no card'}`);
            return;
        }
        if (action.meldRef) {
            const meld = action.meldRef;
            if (meld && meldCard) {
                (action.cards || []).forEach(c => {
                    const idx = p.hand.findIndex(hc => hc.id === c.id);
                    if (idx !== -1) p.hand.splice(idx, 1);
                    meld.cards.push(c);
                });
                if (action.mergeMeldRef) {
                    const mergeIdx = p.exposed.indexOf(action.mergeMeldRef);
                    if (mergeIdx !== -1) p.exposed.splice(mergeIdx, 1);
                    meld.cards.push(...action.mergeMeldRef.cards);
                }
                if (action.quadTypes) {
                    meld.quadTypes = action.quadTypes;
                }
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
            const newMeld = { type: action.type, cards: meldCards };
            if (action.quadTypes) newMeld.quadTypes = action.quadTypes;
            p.exposed.push(newMeld);
            this.emit('ACTION_ANNOUNCE', { playerIndex: humanIdx, type: action.type });

            // Rule 6 removal
            if (this.activeCardSource !== null && this.activeCardSource !== 'DECK' && this.activeCardSource !== humanIdx) {
                const prevP = this.players[this.activeCardSource];
                prevP.removePassedCard(meldCard);
            }
        }

        this.activeCard = null;

        // Check Harmony
        if (this.finishHarmonyIfWon(p)) return;

        const skipDiscard = ['KAI-ZAO', 'XIA-CE'].includes(action.type);

        // 2. Discard. A must-meld with no legal discard is baozi, including a
        // harmony-shaped hand that scores 0 rewards and therefore cannot win.
        if (!skipDiscard) {
            if (this.revealNakedQuadIfPresent(p)) {
                if (this.finishHarmonyIfWon(p)) return;
            } else {
                if (this.declareBaoziIfNoLegalDiscard(p)) return;
                if (discardCard) {
                    const dIdx = p.hand.findIndex(c => c.id === discardCard.id);
                    if (dIdx !== -1) {
                        const dCard = p.discard(dIdx);
                        p.addToDiscards(dCard, false);
                        this.log(`${p.name} discarded ${dCard.toString()}`);
                    }
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
            this.scheduleFlow(this.autoPlayDelay, () => this.botDiscard(player));
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

        this.scheduleFlow(GAME_SPEEDS.DISCARD_HIGHLIGHT, () => {
            this.finalizeDiscard(p, card);
        });
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

            if (!nextPlayer.isHuman || this.isWatchMode) this.scheduleFlow(this.autoPlayDelay, () => this.botDiscard(nextPlayer));
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

        this.scheduleFlow(GAME_SPEEDS.NEXT_TURN_DELAY, () => {
            this.highlightedCards = [];
            this.startTurn();
        });
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

    handAfterMeldClaim(hand, action) {
        if (!action || !action.cards || action.cards.length === 0) return hand;
        const claimedIds = new Set((action.cards || []).map(c => c.id));
        return hand.filter(c => !claimedIds.has(c.id));
    }

    logHarmony(player, reward) {
        const keys = (reward.reasons || []).join(', ');
        this.log(`${player.name} declares HARMONY! Rewards: ${reward.total} [${keys}]`);
    }

    // The completing card is already part of the hand or an exposed meld.
    finishHarmonyIfWon(player) {
        const playerIndex = this.players.indexOf(player);
        const reward = Rules.calculateRewards(player.hand, player.exposed, null, {
            isSelfDraw: this.isSelfDrawFor(playerIndex)
        });
        if (reward.total < 1) return false;
        this.logHarmony(player, reward);
        this.endGame({ winner: player, rewards: reward.total });
        return true;
    }

    declareBaoziIfNoLegalDiscard(player) {
        if (Rules.firstLegalDiscardIndex(player.hand) !== -1) return false;
        this.log(`${player.name} is BAO-ZI! (No cards to discard)`);
        this.endGame({ winner: null, special: 'BAO-ZI', triggerPlayer: player });
        return true;
    }

    checkHarmony(player) {
        const playerIndex = this.players.indexOf(player);
        return Rules.canDeclareHarmony(player.hand, player.exposed, null, {
            isSelfDraw: this.isSelfDrawFor(playerIndex)
        });
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
            // Everyone wins except the trigger player; each winner gets 1 reward (大).
            this.players.forEach(p => {
                if (p.name !== result.triggerPlayer.name) {
                    p.wins++;
                    p.totalRewards += 1;
                }
            });
        } else if (result.winner) {
            // A specific winner. Rewards apply only to that player's harmonizing hand.
            const earned = result.rewards || 0;
            this.players.forEach(p => {
                if (p.name === result.winner.name) {
                    p.wins++;
                    p.totalRewards += earned;
                }
            });
        }
        // If result.winner is null and result.special is not BAO-ZI, it's a draw (no wins incremented).

        // 3. Save stats for all players
        this.players.forEach(p => p.saveStats());

        // 4. Emit the event
        this.emit(EVENTS.GAME_OVER, result);
        this.emit(EVENTS.STATE_CHANGE);
    }
}
