import { Game } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import { Card } from '../src/js/card.js';
import { Rules } from '../src/js/rules.js';

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

    if (failed > 0) {
        console.error(`${failed} flow test(s) failed.`);
        process.exit(1);
    }
    console.log('All flow tests passed successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runFlowTests();
}
