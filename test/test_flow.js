import { Game, EVENTS } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import { Card } from '../src/js/card.js';
import { Deck } from '../src/js/deck.js';
import { Rules } from '../src/js/rules.js';
import { buildAllVeggieWaiverState } from './test_harmony.js';

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
    if (meld.type === 'CHI') {
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
        const state = buildAllVeggieWaiverState();
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
        const state = buildAllVeggieWaiverState();
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

    // A discard from hand must not complete the next player's exposed KOU.
    withFakeTimers(() => {
        const game = new Game();
        game.players = [
            new Player('You', true),
            new Player('Bot Left', false),
            new Player('Bot Right', false)
        ];
        const ren = card(510, 0, 2); // 人 discarded from hand
        const shang = card(511, 0, 0);
        const da = card(512, 0, 1);
        const kou = { type: 'KOU', cards: [shang, da] };
        game.currentPlayerIndex = 0;
        game.drawnCardId = null;
        game.players[0].hand = [ren];
        game.players[1].exposed = [kou];

        game.finalizeDiscard(game.players[0], ren);

        assert(
            'A discard does not complete the next player KOU',
            kou.type === 'KOU'
                && kou.cards.length === 2
                && game.players[0].discards.length === 1
                && game.players[0].discards[0].id === ren.id
                && game.players.every(p => p.exposed.every(m => m.type !== 'SUITE')),
            `kou=${kou.type}/${kou.cards.length} discards=${game.players[0].discards.length}`
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

    // Regression test: Bot with three 小 in hand must NOT break them to form KOU with 生,
    // and must form KAI-ZAO when later self-drawing the 4th 小.
    withFakeTimers(() => {
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const xiao1 = card(601, 4, 1); // 小
        const xiao2 = card(602, 4, 1); // 小
        const xiao3 = card(603, 4, 1); // 小
        const spare = card(604, 0, 1); // 大
        const sheng = card(605, 4, 2); // 生
        const xiao4 = card(606, 4, 1); // 4th 小

        game.players[1].hand = [xiao1, xiao2, xiao3, spare];
        game.players[0].hand = [card(607, 3, 0)];
        game.players[2].hand = [card(608, 5, 0)];

        // Step 1: Bot 2 draws 生 -> cannot break 小x3 for KOU, must PASS
        game.currentPlayerIndex = 1;
        game.activeCard = sheng;
        game.activeCardSource = 'DECK';
        const shengActions = game.calculateActions(sheng);
        game.resolveBotActions(sheng, shengActions);

        assert(
            'Bot 2 does not break three 小 in hand to form KOU with 生',
            game.players[1].exposed.length === 0
                && game.players[1].hand.filter(c => c.character === '小').length === 3
                && game.players[1].passedCards.some(c => c.id === sheng.id),
            `exposed=${game.players[1].exposed.map(m => m.type).join(',')} hand=${game.players[1].hand.map(c => c.character).join('')}`
        );

        // Step 2: Later Bot 2 self-draws the 4th 小 -> forms KAI-ZAO
        game.currentPlayerIndex = 1;
        game.activeCard = xiao4;
        game.activeCardSource = 'DECK';
        game.declinedPlayers.clear();
        const xiao4Actions = game.calculateActions(xiao4);
        game.resolveBotActions(xiao4, xiao4Actions);

        assert(
            'Bot 2 forms KAI-ZAO when self-drawing the 4th 小',
            game.players[1].exposed.length === 1
                && game.players[1].exposed[0].type === 'KAI-ZAO'
                && game.players[1].exposed[0].cards.length === 4
                && game.players[1].hand.length === 1 && game.players[1].hand[0].id === spare.id,
            `exposed=${game.players[1].exposed.map(m => m.type).join(',')} hand=${game.players[1].hand.map(c => c.character).join('')}`
        );
    });

    // [RULE-EXPOSED-PRIORITY]: Upgrading exposed KOU to CHI takes priority over in-hand KOU
    withFakeTimers(() => {
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const expKou = { type: 'KOU', cards: [card(701, 4, 0), card(702, 4, 1)] }; // 尔, 小 in exposed
        const handEr = card(703, 4, 0);   // 尔 in hand
        const handXiao = card(704, 4, 1); // 小 in hand
        const spare = card(705, 3, 0);    // 七 (discardable)
        const sheng = card(706, 4, 2);    // incoming 生

        game.players[0].exposed = [expKou];
        game.players[0].hand = [spare, handEr, handXiao];
        game.players[1].hand = [card(707, 5, 0)];
        game.players[2].hand = [card(708, 6, 0)];

        game.currentPlayerIndex = 0;
        game.activeCard = sheng;
        game.activeCardSource = 'DECK';
        const actions = game.calculateActions(sheng);
        game.resolveBotActions(sheng, actions);

        assert(
            '[RULE-EXPOSED-PRIORITY] Incoming 生 upgrades exposed 尔小 KOU to CHI and leaves in-hand 尔小 intact',
            game.players[0].exposed.length === 1
                && game.players[0].exposed[0].type === 'CHI'
                && game.players[0].exposed[0].cards.length === 3
                && game.players[0].hand.length === 2
                && game.players[0].hand.some(c => c.id === handEr.id)
                && game.players[0].hand.some(c => c.id === handXiao.id)
                && game.players[0].discards.length === 1 && game.players[0].discards[0].id === spare.id,
            `exposed=${game.players[0].exposed.map(m => m.type).join(',')} hand=${game.players[0].hand.map(c => c.character).join('')}`
        );
    });

    // [RULE-MELD-UPGRADE-SAO] & [RULE-MELD-UPGRADE-TWO-DRAGONS]: Exposed SAO upgrades and merges
    withFakeTimers(() => {
        const game = new Game();
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];

        // 1. Exposed SAO (尔x3) + 小 in hand + incoming 4th 尔 -> HALF-DRAGON (5 cards in exposed) + discard
        const saoMeld = {
            type: 'SAO',
            cards: [card(710, 4, 0), card(711, 4, 0), card(712, 4, 0)]
        };
        const xiaoInHand = card(713, 4, 1);
        const spare1 = card(714, 3, 0);
        const er4 = card(715, 4, 0);
        game.players[0].exposed = [saoMeld];
        game.players[0].hand = [xiaoInHand, spare1];
        const p0Moves = Rules.getActions(game.players[0].hand, er4, true, game.players[0].exposed);
        game.executeBotMeld(0, er4, p0Moves[0]);

        assert(
            '[RULE-MELD-UPGRADE-SAO] Exposed SAO + 1 same-suit card in hand upgrades into 5-card HALF-DRAGON',
            game.players[0].exposed.length === 1
                && game.players[0].exposed[0].type === 'HALF-DRAGON'
                && game.players[0].exposed[0].cards.length === 5
                && game.players[0].hand.length === 0
                && game.players[0].discards.length === 1 && game.players[0].discards[0].id === spare1.id,
            `type=${game.players[0].exposed[0]?.type} cards=${game.players[0].exposed[0]?.cards.length}`
        );

        // 2. Exposed HALF-DRAGON (尔尔尔尔小) + exposed SAO (生x3) + incoming 4th 生 -> merges into 9-card TWO-DRAGONS-TUSSLING
        const shengSao = {
            type: 'SAO',
            cards: [card(716, 4, 2), card(717, 4, 2), card(718, 4, 2)]
        };
        const spare2 = card(719, 3, 1);
        const sheng4 = card(720, 4, 2);
        game.players[0].exposed.push(shengSao);
        game.players[0].hand = [spare2];
        const tussleMoves = Rules.getActions(game.players[0].hand, sheng4, true, game.players[0].exposed);
        game.executeBotMeld(0, sheng4, tussleMoves[0]);

        assert(
            '[RULE-MELD-UPGRADE-TWO-DRAGONS] Exposed HALF-DRAGON + exposed SAO merges into 9-card TWO-DRAGONS-TUSSLING',
            game.players[0].exposed.length === 1
                && game.players[0].exposed[0].type === 'TWO-DRAGONS-TUSSLING'
                && game.players[0].exposed[0].cards.length === 9
                && game.players[0].exposed[0].cards.map(c => c.character).join('') === '尔尔尔尔小生生生生'
                && game.players[0].hand.length === 0
                && game.players[0].discards.length === 2,
            `exposedCount=${game.players[0].exposed.length} chars=${game.players[0].exposed[0]?.cards.map(c => c.character).join('')}`
        );
    });

    // Issue 22: exposed SAO of 九 + a single 子 must become HALF-DRAGON.
    // That HALF-DRAGON counts as a KOU, so two exposed KOU already means BAO-ZI.
    withFakeTimers(({ drain }) => {
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const sao = {
            type: 'SAO',
            cards: [card(801, 5, 1), card(802, 5, 1), card(803, 5, 1)] // 九
        };
        const zi = card(804, 5, 2); // 子
        const spare = card(805, 3, 0); // 七
        const kouA = { type: 'KOU', cards: [card(806, 0, 0), card(807, 0, 1)] }; // 上大
        const kouB = { type: 'KOU', cards: [card(808, 1, 0), card(809, 1, 1)] }; // 丘乙
        const jiu = card(810, 5, 1);
        game.players[0].exposed = [sao, kouA, kouB];
        game.players[0].hand = [zi, spare];
        game.players[1].hand = [card(811, 4, 0)];
        game.players[2].hand = [card(812, 6, 0)];
        game.currentPlayerIndex = 0;
        game.activeCard = jiu;
        game.activeCardSource = 'DECK';
        const logs = [];
        let over = null;
        game.on(EVENTS.LOG, (msg) => logs.push(msg));
        game.on(EVENTS.GAME_OVER, (res) => { over = res; });

        game.resolveBotActions(jiu, game.calculateActions(jiu));

        const half = game.players[0].exposed.find(m => m.type === 'HALF-DRAGON');
        assert(
            '[RULE-BAO-ZI] Exposed SAO of 九 plus a single 子 is HALF-DRAGON, and a third KOU is BAO-ZI',
            over && over.special === 'BAO-ZI' && over.triggerPlayer === game.players[0]
                && half && half.cards.some(c => c.id === zi.id) && half.cards.some(c => c.id === jiu.id)
                && half.cards.length === 5
                && game.players[0].hand.length === 1 && game.players[0].hand[0].id === spare.id
                && game.players[0].discards.length === 0
                && game.players[0].wins === 0 && game.players[0].totalRewards === 0
                && game.players[1].wins === 1 && game.players[1].totalRewards === 1
                && game.players[2].wins === 1 && game.players[2].totalRewards === 1
                && logs.some(l => l.includes('More than 2 KOU')),
            `over=${over && over.special} half=${half && half.cards.map(c => c.character).join('')} hand=${game.players[0].hand.map(c => c.character).join('')} logs=${logs.join(' | ')}`
        );

        // DRAGON is not a KOU, so two exposed KOU plus both other suit cards still plays on.
        const dragonGame = new Game();
        dragonGame.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const dragonSao = {
            type: 'SAO',
            cards: [card(821, 5, 1), card(822, 5, 1), card(823, 5, 1)]
        };
        const ba = card(824, 5, 0); // 八
        const zi2 = card(825, 5, 2); // 子
        const spare2 = card(826, 3, 1); // 十
        dragonGame.players[0].exposed = [
            dragonSao,
            { type: 'KOU', cards: [card(827, 0, 0), card(828, 0, 1)] },
            { type: 'KOU', cards: [card(829, 1, 0), card(830, 1, 1)] }
        ];
        dragonGame.players[0].hand = [ba, zi2, spare2];
        const jiu2 = card(831, 5, 1);
        let dragonOver = null;
        dragonGame.on(EVENTS.GAME_OVER, (res) => { dragonOver = res; });
        dragonGame.executeBotMeld(0, jiu2, Rules.getActions(
            dragonGame.players[0].hand, jiu2, true, dragonGame.players[0].exposed
        )[0]);
        assert(
            '[RULE-KOU-MAX-EXPOSED] DRAGON with 2 exposed KOU is not a third KOU and is not BAO-ZI',
            dragonOver === null
                && dragonGame.players[0].exposed.some(m => m.type === 'DRAGON' && m.cards.length === 6)
                && dragonGame.players[0].discards.length === 1
                && dragonGame.players[0].discards[0].id === spare2.id
                && Rules.exposedKouCount(dragonGame.players[0].exposed) === 2,
            `over=${dragonOver && dragonOver.special} exposed=${dragonGame.players[0].exposed.map(m => m.type).join(',')} discards=${dragonGame.players[0].discards.map(c => c.character).join('')}`
        );
        dragonGame.flowToken++;

        // Human confirm of the same third-KOU HALF-DRAGON does not ask for the spare discard.
        const humanGame = new Game();
        humanGame.players = [
            new Player('You', true),
            new Player('Bot Left', false),
            new Player('Bot Right', false)
        ];
        const humanSao = {
            type: 'SAO',
            cards: [card(841, 5, 1), card(842, 5, 1), card(843, 5, 1)]
        };
        const humanZi = card(844, 5, 2);
        const humanSpare = card(845, 4, 0);
        humanGame.players[0].exposed = [
            humanSao,
            { type: 'KOU', cards: [card(846, 0, 0), card(847, 0, 1)] },
            { type: 'KOU', cards: [card(848, 1, 0), card(849, 1, 1)] }
        ];
        humanGame.players[0].hand = [humanZi, humanSpare];
        const humanJiu = card(850, 5, 1);
        humanGame.activeCard = humanJiu;
        humanGame.activeCardSource = 'DECK';
        humanGame.currentPlayerIndex = 0;
        let humanOver = null;
        humanGame.on(EVENTS.GAME_OVER, (res) => { humanOver = res; });
        const humanAction = Rules.getActions(
            humanGame.players[0].hand, humanJiu, true, humanGame.players[0].exposed
        )[0];
        humanGame.confirmHumanMeld(humanAction, -1);
        drain(5);
        assert(
            '[RULE-BAO-ZI] Human HALF-DRAGON that would be a third KOU confirms without a discard and loses',
            humanOver && humanOver.special === 'BAO-ZI' && humanOver.triggerPlayer === humanGame.players[0]
                && humanGame.players[0].exposed.some(m => m.type === 'HALF-DRAGON' && m.cards.some(c => c.id === humanZi.id))
                && humanGame.players[0].hand.length === 1 && humanGame.players[0].hand[0].id === humanSpare.id
                && humanGame.players[0].discards.length === 0
                && humanGame.players[1].totalRewards === 1 && humanGame.players[2].totalRewards === 1,
            `over=${humanOver && humanOver.special} hand=${humanGame.players[0].hand.map(c => c.character).join('')} discards=${humanGame.players[0].discards.length}`
        );
    });

    // [RULE-NAKED-QUAD-REVEAL]: Naked 4-of-a-kind in hand is revealed in EXPOSED and skips first discard
    withFakeTimers(({ drain }) => {
        const game = new Game();
        game.players = [
            new Player('You', true),
            new Player('Bot Left', false),
            new Player('Bot Right', false)
        ];

        // 1. Bot holds naked 4-of-a-kind (七x4, no 十 or 土) + 上, 大. Draws 人 -> forms CHI, reveals 七x4 as KAI-ZAO, skips discard!
        const nakedQi = [card(730, 3, 0), card(731, 3, 0), card(732, 3, 0), card(733, 3, 0)];
        const bShang = card(734, 0, 0);
        const bDa = card(735, 0, 1);
        const bRen = card(736, 0, 2);
        game.players[1].hand = [...nakedQi, bShang, bDa];
        game.executeBotMeld(1, bRen, { type: 'CHI', cards: [bShang, bDa] });

        assert(
            '[RULE-NAKED-QUAD-REVEAL] Bot reveals naked 4-of-a-kind in EXPOSED and skips discard (avoiding false BAO-ZI)',
            game.players[1].exposed.length === 2
                && game.players[1].exposed.some(m => m.type === 'CHI' && m.cards.length === 3)
                && game.players[1].exposed.some(m => m.type === 'KAI-ZAO' && m.cards.length === 4)
                && game.players[1].hand.length === 0
                && game.players[1].discards.length === 0
                && game.players[1].totalGames === 0,
            `exposed=${game.players[1].exposed.map(m => m.type).join(',')} hand=${game.players[1].hand.length} discards=${game.players[1].discards.length}`
        );

        // 2. Human holds naked 4-of-a-kind (可x4) + 化, 三 + spare 八. Claims CHI on 千 -> reveals 可x4, skips discard, keeps 八!
        const nakedKe = [card(740, 7, 0), card(741, 7, 0), card(742, 7, 0), card(743, 7, 0)];
        const hHua = card(744, 2, 0);
        const hSan = card(745, 2, 1);
        const hSpare = card(746, 5, 0);
        const hQian = card(747, 2, 2);
        game.players[0].hand = [...nakedKe, hHua, hSan, hSpare];
        game.activeCard = hQian;
        game.activeCardSource = 'DECK';
        game.currentPlayerIndex = 0;
        game.confirmHumanMeld({ type: 'CHI', cards: [hHua, hSan] }, -1);
        drain(20);

        assert(
            '[RULE-NAKED-QUAD-REVEAL] Human reveals naked 4-of-a-kind in EXPOSED, skips discard, and keeps spare card in hand',
            game.players[0].exposed.length === 2
                && game.players[0].exposed.some(m => m.type === 'CHI')
                && game.players[0].exposed.some(m => m.type === 'KAI-ZAO' && m.cards.length === 4)
                && game.players[0].discards.length === 0
                && game.players[0].hand.length === 1 && game.players[0].hand[0].id === hSpare.id,
            `exposed=${game.players[0].exposed.map(m => m.type).join(',')} hand=${game.players[0].hand.length} discards=${game.players[0].discards.length}`
        );
    });

    // [RULE-PRIMARY-PASS], [RULE-SECONDARY-PASS], [RULE-PASSED-RECLAMATION]
    withFakeTimers(({ drain }) => {
        const game = new Game();
        game.isWatchMode = true;
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        const passedCard = card(750, 7, 0); // 可
        const deckNext = card(751, 5, 0);   // 八
        game.deck.cards = [deckNext];
        game.players[0].hand = [card(752, 0, 0)];
        game.players[1].hand = [card(753, 1, 0)];
        game.players[2].hand = [card(754, 2, 0)];

        // Primary Pass: Bot 1 (P0) passes deck-drawn 可 -> enters P0's passedCards and is offered to P1
        game.currentPlayerIndex = 0;
        game.activeCard = passedCard;
        game.activeCardSource = 'DECK';
        game.handlePass(0, passedCard);

        assert(
            '[RULE-PRIMARY-PASS] Passed deck card enters drawer passedCards pile',
            game.players[0].passedCards.length === 1 && game.players[0].passedCards[0].id === passedCard.id
                && game.activeCardSource === 0,
            `passed=${game.players[0].passedCards.length} source=${game.activeCardSource}`
        );

        // Drain primary pass + secondary pass + next turn draw
        drain(20);
        assert(
            '[RULE-SECONDARY-PASS] Downstream decline leaves card in passer passedCards and draws next card from deck',
            game.players[0].passedCards.length === 1 && game.players[0].passedCards[0].id === passedCard.id
                && game.deck.isEmpty(),
            `passed=${game.players[0].passedCards.length} deck=${game.deck.cards.length}`
        );

        // Reclamation on exposed KOU upgrade: P1 upgrades exposed KOU (知礼) with P0's passed 可 -> removes 可 from P0's passedCards
        game.players[1].exposed = [{ type: 'KOU', cards: [card(755, 7, 1), card(756, 7, 2)] }];
        game.activeCardSource = 0;
        game.executeBotMeld(1, passedCard, { type: 'CHI', cards: [], meldRef: game.players[1].exposed[0] });
        assert(
            '[RULE-PASSED-RECLAMATION] Upgrading an exposed KOU with a passed card removes it from passer passedCards',
            game.players[0].passedCards.length === 0 && game.players[1].exposed[0].type === 'CHI',
            `p0Passed=${game.players[0].passedCards.length} p1Meld=${game.players[1].exposed[0].type}`
        );
    });

    // Issue #20 seed 4088527162: Bot 1 is dealt 可知礼礼礼. The passed 可 must not become a KOU.
    withFakeTimers(({ drain }) => {
        const game = new Game();
        const random = Math.random;
        Math.random = () => 0.95;
        const logs = [];
        game.log = (msg) => logs.push(msg);
        game.isWatchMode = true;
        game.deck = new Deck(4088527162);
        game.players = [
            new Player('Bot 1', false),
            new Player('Bot 2', false),
            new Player('Bot 3', false)
        ];
        for (let i = 0; i < 15; i++) {
            game.players.forEach(p => p.draw(game.deck.draw()));
        }
        const bot1 = game.players[0].hand.map(c => c.character).join('');
        game.currentPlayerIndex = 2;
        game.startTurn();
        drain(40);
        Math.random = random;
        const opened = logs.slice(0, 6).join(' | ');
        assert(
            'Issue #20 seed: Bot 1 declines the passed 可 instead of forming KOU',
            bot1.includes('可') && bot1.includes('知') && bot1.split('礼').length - 1 === 3
                && logs.some(l => l.includes('Bot 3 PASS (Passed) 可'))
                && logs.some(l => l.includes('Bot 1 declined passed card'))
                && !logs.slice(0, 8).some(l => l.includes('Bot 1 performs KOU')),
            `hand=${bot1} log=${opened}`
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
