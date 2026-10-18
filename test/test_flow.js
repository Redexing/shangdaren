import { Game, EVENTS } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import { Card } from '../src/js/card.js';
import { Rules } from '../src/js/rules.js';
import { buildScreenshotHarmonyState } from './test_harmony.js';

function card(id, suiteIndex, characterIndex) {
    return new Card(id, suiteIndex, characterIndex);
}

function withFakeTimers(run) {
    const queue = [];
    let now = 0;
    const origSet = global.setTimeout;
    const origClear = global.clearTimeout;
    global.setTimeout = (fn, ms = 0) => {
        const id = queue.length + 1;
        queue.push({ id, time: now + ms, fn });
        return id;
    };
    global.clearTimeout = (id) => {
        const idx = queue.findIndex(item => item.id === id);
        if (idx !== -1) queue.splice(idx, 1);
    };
    const drain = (limit = 4000) => {
        let steps = 0;
        while (queue.length && steps < limit) {
            queue.sort((a, b) => a.time - b.time || a.id - b.id);
            const item = queue.shift();
            now = item.time;
            item.fn();
            steps++;
        }
        return steps;
    };
    try {
        return run({ queue, drain });
    } finally {
        global.setTimeout = origSet;
        global.clearTimeout = origClear;
    }
}

function meldIsLegal(meld) {
    const suits = new Set(meld.cards.map(c => c.suiteIndex));
    if (meld.type === 'CHI' || meld.type === 'SUITE') {
        return meld.cards.length === 3
            && suits.size === 1
            && new Set(meld.cards.map(c => c.characterIndex)).size === 3;
    }
    if (meld.type === 'KOU') {
        return meld.cards.length === 2 && suits.size === 1;
    }
    return meld.cards.length > 0 && suits.size === 1;
}

export function runFlowTests() {
    console.log('Running stale-timer and CHI upgrade tests...');
    let failed = 0;
    const assert = (name, condition, detail) => {
        if (condition) console.log(`✅ ${name}: Passed`);
        else {
            console.error(`❌ ${name}: Failed`);
            if (detail) console.error(`   ${detail}`);
            failed++;
        }
    };

    const kou = { type: 'KOU', cards: [card(1, 7, 1), card(2, 7, 2)] }; // 知, 礼
    const ke = card(3, 7, 0); // 可
    const jia = card(4, 6, 0); // 佳
    assert(
        'CHI completes a same-suit KOU',
        Rules.isLegalMeldUpgrade(kou, ke, 'CHI') === true
    );
    assert(
        'CHI rejects a card from another suit',
        Rules.isLegalMeldUpgrade(kou, jia, 'CHI') === false
    );

    withFakeTimers(() => {
        const game = new Game();
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        game.players[0].exposed = [kou];
        game.players[0].hand = [card(10, 0, 0), card(11, 3, 0)];
        game.currentPlayerIndex = 0;
        game.executeBotMeld(0, ke, { type: 'CHI', cards: [], meldRef: kou });
        assert(
            '可 upgrades 知礼 into a 3-card CHI',
            kou.type === 'CHI' && kou.cards.map(c => c.character).sort().join('') === '可知礼',
            kou.cards.map(c => c.character).join('')
        );
        game.executeBotMeld(0, jia, { type: 'CHI', cards: [], meldRef: kou });
        assert(
            'A second CHI cannot attach 佳 to that meld',
            kou.cards.length === 3 && !kou.cards.some(c => c.character === '佳'),
            kou.cards.map(c => c.character).join('')
        );
    });

    withFakeTimers(({ queue, drain }) => {
        const game = new Game();
        const staleMeld = { type: 'KOU', cards: [card(21, 7, 1), card(22, 7, 2)] };
        let staleRan = false;
        game.players = [new Player('Bot 1', false), new Player('Bot 2', false), new Player('Bot 3', false)];
        game.players[0].exposed = [staleMeld];
        game.scheduleFlow(10, () => {
            staleRan = true;
            staleMeld.cards.push(jia);
        });
        game.init(true);
        const queuedBeforeDrain = queue.length;
        drain(30);
        assert(
            'A new game cancels timers from the previous one',
            staleRan === false && staleMeld.cards.length === 2,
            `staleRan=${staleRan} cards=${staleMeld.cards.length} queued=${queuedBeforeDrain}`
        );
        game.flowToken++;
    });

    withFakeTimers(({ drain }) => {
        const game = new Game();
        const logs = [];
        game.log = (msg) => logs.push(msg);
        game.init(true);
        const steps = drain();
        const illegal = [];
        game.players.forEach(p => {
            p.exposed.forEach(m => {
                if (!meldIsLegal(m)) illegal.push(`${p.name} ${m.type} ${m.cards.map(c => c.character).join('')}`);
            });
        });
        const ended = game.deck.isEmpty() || logs.some(l => l.includes('Deck empty') || l.includes('HARMONY') || l.includes('BAO-ZI'));
        assert(
            'A watched bot game finishes without a mixed CHI',
            ended && illegal.length === 0 && steps < 4000,
            `ended=${ended} steps=${steps} illegal=${illegal.join('; ')} deck=${game.deck.cards.length}`
        );
    });

    // [RULE-INTERRUPT-PRIORITY]: 1. HARMONY > 2. Trips/Quads > 3. Drawer (CHI/KOU/PASS)
    withFakeTimers(({ drain }) => {
        // Case A: Interrupter P1 has PENG, Interrupter P2 has HARMONY, Drawer P0 has KOU -> P2 HARMONY wins
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const state = buildScreenshotHarmonyState();
        const zuo = state.activeCard; // 作 (suite 6, char 1)
        game.currentPlayerIndex = 0;
        game.activeCard = zuo;
        game.activeCardSource = 'DECK';
        // Drawer P0 could form KOU on 作 with 佳
        game.players[0].hand = [card(301, 6, 0), card(302, 3, 0)];
        // Interrupter P1 holds two 作 -> can PENG
        game.players[1].hand = [card(303, 6, 1), card(304, 6, 1), card(305, 3, 1)];
        // Interrupter P2 has a ready Harmony hand on 作
        game.players[2].hand = state.hand;
        game.players[2].exposed = state.exposed;

        let overResult = null;
        game.on(EVENTS.GAME_OVER, (res) => { overResult = res; });

        const actionMap = game.calculateActions(zuo);
        game.resolveBotActions(zuo, actionMap);
        drain(20);

        assert(
            '[RULE-INTERRUPT-PRIORITY] HARMONY (P2) takes priority over PENG (P1) and KOU (Drawer P0)',
            overResult !== null && overResult.winner === game.players[2]
                && game.players[1].exposed.length === 0,
            `winner=${overResult && overResult.winner ? overResult.winner.name : 'none'} p1Exposed=${game.players[1].exposed.length}`
        );
    });

    withFakeTimers(({ drain }) => {
        // Case B: Drawer P0 has HARMONY on self-draw, Interrupter P1 has PENG -> Drawer HARMONY wins
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const state = buildScreenshotHarmonyState();
        const zuo = state.activeCard;
        game.currentPlayerIndex = 0;
        game.activeCard = zuo;
        game.activeCardSource = 'DECK';
        game.players[0].hand = state.hand;
        game.players[0].exposed = state.exposed;
        game.players[1].hand = [card(310, 6, 1), card(311, 6, 1), card(312, 3, 0)];
        game.players[2].hand = [];

        let overResult = null;
        game.on(EVENTS.GAME_OVER, (res) => { overResult = res; });

        const actionMap = game.calculateActions(zuo);
        game.resolveBotActions(zuo, actionMap);
        drain(20);

        assert(
            '[RULE-INTERRUPT-PRIORITY] Drawer HARMONY takes priority over interrupter PENG',
            overResult !== null && overResult.winner === game.players[0]
                && game.players[1].exposed.length === 0,
            `winner=${overResult && overResult.winner ? overResult.winner.name : 'none'}`
        );
    });

    withFakeTimers(() => {
        // Case C: Interrupter P1 has PENG, Drawer P0 has CHI -> P1 PENG preempts Drawer CHI
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const ren = card(320, 0, 2); // 人
        game.currentPlayerIndex = 0;
        game.activeCard = ren;
        game.activeCardSource = 'DECK';
        // Drawer P0 has 上, 大 + spare card -> would form CHI if uninterrupted
        game.players[0].hand = [card(321, 0, 0), card(322, 0, 1), card(323, 3, 0)];
        // Interrupter P1 has two 人 + spare card -> mandatory PENG interrupt
        game.players[1].hand = [card(324, 0, 2), card(325, 0, 2), card(326, 4, 0)];
        game.players[2].hand = [card(327, 5, 0)];

        const actionMap = game.calculateActions(ren);
        game.resolveBotActions(ren, actionMap);

        assert(
            '[RULE-INTERRUPT-PRIORITY] Interrupter PENG takes priority over Drawer CHI',
            game.players[1].exposed.length === 1 && game.players[1].exposed[0].type === 'PENG'
                && game.players[0].exposed.length === 0 && game.players[0].hand.length === 3,
            `p1Exposed=${game.players[1].exposed.map(m => m.type).join(',')} p0Exposed=${game.players[0].exposed.length}`
        );
    });

    withFakeTimers(() => {
        // Case D: No interrupts -> Drawer CHI executes
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const ren = card(330, 0, 2); // 人
        game.currentPlayerIndex = 0;
        game.activeCard = ren;
        game.activeCardSource = 'DECK';
        game.players[0].hand = [card(331, 0, 0), card(332, 0, 1), card(333, 3, 0)];
        game.players[1].hand = [card(334, 4, 0)];
        game.players[2].hand = [card(335, 5, 0)];

        const actionMap = game.calculateActions(ren);
        game.resolveBotActions(ren, actionMap);

        assert(
            '[RULE-INTERRUPT-PRIORITY] Drawer CHI executes when no higher-priority interrupt exists',
            game.players[0].exposed.length === 1 && game.players[0].exposed[0].type === 'CHI'
                && game.players[0].discards.length === 1 && game.players[0].discards[0].id === 333,
            `p0Exposed=${game.players[0].exposed.map(m => m.type).join(',')} discards=${game.players[0].discards.length}`
        );
    });

    // [RULE-DISCARD-EXEMPT-QUADS]: Forming XIA-CE or KAI-ZAO does NOT require a discard
    withFakeTimers(({ drain }) => {
        const game = new Game();
        game.players = [
            new Player('You', true),
            new Player('Bot Left', false),
            new Player('Bot Right', false)
        ];

        // 1. Bot KAI-ZAO from 3 in hand + self-drawn 4th card skips discard (even with 0 spare cards)
        const kzHand = [card(401, 0, 0), card(402, 0, 0), card(403, 0, 0)];
        const kzDraw = card(404, 0, 0);
        game.players[1].hand = [...kzHand];
        game.executeBotMeld(1, kzDraw, { type: 'KAI-ZAO', cards: kzHand });
        assert(
            '[RULE-DISCARD-EXEMPT-QUADS] Bot KAI-ZAO skips discard and does not trigger BAO-ZI with 0 cards left',
            game.players[1].exposed.length === 1 && game.players[1].exposed[0].type === 'KAI-ZAO'
                && game.players[1].discards.length === 0 && game.players[1].totalGames === 0,
            `discards=${game.players[1].discards.length} games=${game.players[1].totalGames}`
        );

        // 2. Bot XIA-CE from 3 in hand + other's drawn 4th card keeps spare card in hand
        const xcHand = [card(405, 1, 0), card(406, 1, 0), card(407, 1, 0)];
        const spare = card(408, 3, 0);
        const xcDraw = card(409, 1, 0);
        game.players[2].hand = [...xcHand, spare];
        game.executeBotMeld(2, xcDraw, { type: 'XIA-CE', cards: xcHand });
        assert(
            '[RULE-DISCARD-EXEMPT-QUADS] Bot XIA-CE skips discard and preserves spare hand card',
            game.players[2].exposed.length === 1 && game.players[2].exposed[0].type === 'XIA-CE'
                && game.players[2].discards.length === 0
                && game.players[2].hand.length === 1 && game.players[2].hand[0].id === spare.id,
            `hand=${game.players[2].hand.length} discards=${game.players[2].discards.length}`
        );

        // 3. Human confirmHumanMeld for KAI-ZAO / XIA-CE with discardCardIndex = -1 skips discard
        const hCards = [card(410, 2, 0), card(411, 2, 0), card(412, 2, 0)];
        const hSpare = card(413, 4, 0);
        const hActive = card(414, 2, 0);
        game.players[0].hand = [...hCards, hSpare];
        game.activeCard = hActive;
        game.activeCardSource = 1;
        game.confirmHumanMeld({ type: 'XIA-CE', cards: hCards }, -1);
        drain(20);
        assert(
            '[RULE-DISCARD-EXEMPT-QUADS] Human XIA-CE confirms with discardCardIndex=-1 and skips discard',
            game.players[0].exposed.length === 1 && game.players[0].exposed[0].type === 'XIA-CE'
                && game.players[0].discards.length === 0
                && game.players[0].hand.length === 1 && game.players[0].hand[0].id === hSpare.id,
            `exposed=${game.players[0].exposed.length} hand=${game.players[0].hand.length} discards=${game.players[0].discards.length}`
        );
    });

    // [RULE-DISCARD-RESTRICTION-MELD]: Cards committed to forming the new meld cannot be discarded
    withFakeTimers(({ drain }) => {
        const game = new Game();
        game.players = [
            new Player('You', true),
            new Player('Bot Left', false),
            new Player('Bot Right', false)
        ];
        const shang = card(501, 0, 0); // 上
        const da = card(502, 0, 1);    // 大
        const qi = card(503, 3, 0);    // 七 (unrelated third card)
        const ren = card(504, 0, 2);   // incoming 人

        game.players[0].hand = [shang, da, qi];
        game.activeCard = ren;
        game.activeCardSource = 'DECK';
        game.currentPlayerIndex = 0;

        const chiAction = { type: 'CHI', cards: [shang, da] };
        const remaining = game.handAfterMeldClaim(game.players[0].hand, chiAction);
        assert(
            '[RULE-DISCARD-RESTRICTION-MELD] handAfterMeldClaim excludes cards committed to the new meld',
            remaining.length === 1 && remaining[0].id === qi.id,
            `remaining=${remaining.map(c => c.character).join('')}`
        );

        // Attempting to discard 上 (index 0) or 大 (index 1) must be rejected
        game.confirmHumanMeld(chiAction, 0);
        game.confirmHumanMeld(chiAction, 1);
        drain(20);
        assert(
            '[RULE-DISCARD-RESTRICTION-MELD] confirmHumanMeld rejects discarding 上 or 大 used in the CHI meld',
            game.players[0].exposed.length === 0
                && game.players[0].discards.length === 0
                && game.players[0].hand.length === 3,
            `exposed=${game.players[0].exposed.length} hand=${game.players[0].hand.length}`
        );

        // Discarding the unrelated 七 (index 2) succeeds
        game.activeCard = ren;
        game.confirmHumanMeld(chiAction, 2);
        drain(20);
        assert(
            '[RULE-DISCARD-RESTRICTION-MELD] confirmHumanMeld succeeds when discarding unrelated card 七',
            game.players[0].exposed.length === 1 && game.players[0].exposed[0].type === 'CHI'
                && game.players[0].discards.length === 1 && game.players[0].discards[0].id === qi.id
                && game.players[0].hand.length === 0,
            `exposed=${game.players[0].exposed.length} discards=${game.players[0].discards.map(c => c.character).join('')}`
        );
    });

    // [RULE-DECK-EXHAUSTION]: Drawing on an empty deck ends the game in a draw (tie)
    withFakeTimers(() => {
        const game = new Game();
        game.players = [
            new Player('You', true),
            new Player('Bot Left', false),
            new Player('Bot Right', false)
        ];
        game.deck.cards = []; // Empty deck
        const logs = [];
        let overPayload = null;
        game.on(EVENTS.LOG, (msg) => logs.push(msg));
        game.on(EVENTS.GAME_OVER, (res) => { overPayload = res; });

        game.drawCard();

        assert(
            '[RULE-DECK-EXHAUSTION] Drawing on an empty deck ends the game in a draw with 0 wins and 0 rewards',
            overPayload !== null && overPayload.winner === null && !overPayload.special
                && logs.some(l => l.includes('Deck empty. Draw game.'))
                && game.players.every(p => p.totalGames === 1 && p.wins === 0 && p.totalRewards === 0),
            `payload=${JSON.stringify(overPayload)} games=${game.players.map(p => p.totalGames).join(',')}`
        );
    });

    if (failed > 0) {
        console.error(`${failed} flow test(s) failed.`);
        process.exit(1);
    }
    console.log('All flow tests passed successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runFlowTests();
}
