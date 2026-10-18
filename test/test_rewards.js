import { Game } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import { Card } from '../src/js/card.js';
import { Rules } from '../src/js/rules.js';
import { buildScreenshotHarmonyState } from './test_harmony.js';

let nextId = 2000;
function card(suiteIndex, characterIndex) {
    return new Card(nextId++, suiteIndex, characterIndex);
}
function cards(suiteIndex, characterIndex, count) {
    return Array.from({ length: count }, () => card(suiteIndex, characterIndex));
}
function chi(suiteIndex) {
    return [card(suiteIndex, 0), card(suiteIndex, 1), card(suiteIndex, 2)];
}
function kou(suiteIndex, a, b) {
    return [card(suiteIndex, a), card(suiteIndex, b)];
}

function createBareGame() {
    const game = new Game();
    game.players = [
        new Player('You', true),
        new Player('Bot Left', false),
        new Player('Bot Right', false)
    ];
    game.pendingActions = new Map();
    game.declinedPlayers = new Set();
    game.highlightedCards = [];
    game.listeners = {};
    return game;
}

export function runRewardTests() {
    console.log('Running reward (大) tests...');
    let failed = 0;

    function assert(name, condition, detail) {
        if (condition) {
            console.log(`✅ ${name}: Passed`);
        } else {
            console.error(`❌ ${name}: Failed`);
            if (detail) console.error(`   ${detail}`);
            failed++;
        }
    }

    function expectReward(name, hand, exposed, activeCard, options, total, reasons) {
        const reward = Rules.calculateRewards(hand, exposed, activeCard, options);
        const canDeclare = Rules.canDeclareHarmony(hand, exposed, activeCard, options);
        const reasonText = (reward.reasons || []).join(', ');
        const shapeOk = reward.points !== undefined;
        assert(
            name,
            shapeOk && reward.total === total && canDeclare === (total >= 1)
                && (!reasons || reasons.every(r => reward.reasons.includes(r)) && reward.reasons.length === reasons.length),
            `total=${reward.total} points=${reward.points} reasons=${reasonText} harmony=${canDeclare}`
        );
    }

    // Exactly 10 fu, mixed colors and suits: the 10-fu bonus is the only reward.
    expectReward(
        'Exactly 10 fu scores 1 reward',
        [
            ...kou(0, 0, 1),
            ...kou(1, 0, 1),
            ...chi(2),
            ...chi(0),
            ...chi(3),
            ...chi(4)
        ],
        [],
        null,
        {},
        1,
        ['exact-10']
    );

    // 11 fu, mixed, no special shape. Self-draw is the only way in.
    const elevenHand = [
        ...kou(0, 0, 1),
        ...kou(1, 0, 1),
        ...chi(2),
        ...chi(5),
        card(3, 0),
        card(3, 1)
    ];
    const elevenExposed = [{ type: 'SAO', cards: cards(4, 0, 3) }];
    const elevenActive = card(3, 2);
    expectReward('11-fu mixed hand scores 0 without self-draw', elevenHand, elevenExposed, elevenActive, {}, 0, []);
    expectReward('11-fu mixed hand scores 1 on self-draw', elevenHand, elevenExposed, elevenActive, { isSelfDraw: true }, 1, ['self-draw']);

    // Veggie dragon of 八 plus two meat kous and filler chis. Dragon is the only bonus.
    expectReward(
        'A full dragon scores 1 reward',
        [
            ...kou(0, 0, 1),
            ...kou(1, 0, 1),
            ...chi(2),
            ...chi(3),
            ...cards(5, 0, 4),
            card(5, 1),
            card(5, 2)
        ],
        [],
        null,
        {},
        1,
        ['dragon-snake']
    );

    // [RULE-MELD-UPGRADE-TWO-DRAGONS]: Two-Dragons-Tussling (双龙抱柱) earns 3 rewards by itself,
    // and its points equal the sum of the two quads + 2 Fu if Meat.
    {
        const meatTussling26 = {
            type: 'TWO-DRAGONS-TUSSLING',
            cards: [...cards(1, 0, 4), card(1, 1), ...cards(1, 2, 4)],
            quadTypes: ['KAI-ZAO', 'KAI-ZAO']
        };
        const meatTussling24 = { ...meatTussling26, quadTypes: ['KAI-ZAO', 'XIA-CE'] };
        const meatTussling22 = { ...meatTussling26, quadTypes: ['XIA-CE', 'XIA-CE'] };
        const vegTussling16 = {
            type: 'TWO-DRAGONS-TUSSLING',
            cards: [...cards(4, 0, 4), card(4, 1), ...cards(4, 2, 4)],
            quadTypes: ['KAI-ZAO', 'KAI-ZAO']
        };
        const vegTussling14 = { ...vegTussling16, quadTypes: ['XIA-CE', 'KAI-ZAO'] };
        const vegTussling12 = { ...vegTussling16, quadTypes: ['XIA-CE', 'XIA-CE'] };

        assert(
            '[RULE-MELD-UPGRADE-TWO-DRAGONS] Meat TWO-DRAGONS-TUSSLING scores 26 / 24 / 22 Fu',
            Rules.calculateTotalPoints([meatTussling26]) === 26
                && Rules.calculateTotalPoints([meatTussling24]) === 24
                && Rules.calculateTotalPoints([meatTussling22]) === 22,
            `got=${Rules.calculateTotalPoints([meatTussling26])}/${Rules.calculateTotalPoints([meatTussling24])}/${Rules.calculateTotalPoints([meatTussling22])}`
        );
        assert(
            '[RULE-MELD-UPGRADE-TWO-DRAGONS] Veggie TWO-DRAGONS-TUSSLING scores 16 / 14 / 12 Fu',
            Rules.calculateTotalPoints([vegTussling16]) === 16
                && Rules.calculateTotalPoints([vegTussling14]) === 14
                && Rules.calculateTotalPoints([vegTussling12]) === 12,
            `got=${Rules.calculateTotalPoints([vegTussling16])}/${Rules.calculateTotalPoints([vegTussling14])}/${Rules.calculateTotalPoints([vegTussling12])}`
        );

        // Veggie TWO-DRAGONS-TUSSLING (12 Fu) + 2 Meat KOUs (4 Fu) + 1 Veggie CHI (0 Fu) = 16 Fu, mixed suits/colors -> 3 rewards
        expectReward(
            '[RULE-MELD-UPGRADE-TWO-DRAGONS] TWO-DRAGONS-TUSSLING scores 3 rewards by itself',
            [
                ...kou(0, 0, 1),
                ...kou(1, 0, 1),
                ...chi(5)
            ],
            [vegTussling12],
            null,
            {},
            3,
            ['two-dragons-tussling']
        );

        // Meat TWO-DRAGONS-TUSSLING (26 Fu) + 2 Veggie KOUs (0 Fu) + 1 Veggie CHI (0 Fu) = 26 Fu -> two-dragons-tussling (3) + score-20 (1) = 4 rewards
        expectReward(
            '[RULE-MELD-UPGRADE-TWO-DRAGONS] Meat TWO-DRAGONS-TUSSLING (26 Fu) stacks with score-20 for 4 rewards',
            [
                ...kou(3, 0, 1),
                ...kou(4, 0, 1),
                ...chi(5)
            ],
            [meatTussling26],
            null,
            {},
            4,
            ['score-20', 'two-dragons-tussling']
        );
    }

    // Half-dragon is not a full snake/dragon. This one is also not a special quad.
    expectReward(
        'Half-dragon alone does not score a reward',
        [
            ...cards(1, 0, 4),
            card(1, 1),
            ...kou(3, 0, 1),
            ...chi(4),
            ...chi(5),
            ...chi(2)
        ],
        [],
        null,
        {},
        0,
        []
    );

    // Four 上 inside a half-dragon: the special-quad bonus, not the dragon bonus.
    expectReward(
        'Four 上 scores the special-quad reward',
        [
            ...cards(0, 0, 4),
            card(0, 1),
            ...kou(3, 0, 1),
            ...chi(4),
            ...chi(5),
            ...chi(1)
        ],
        [],
        null,
        {},
        2,
        ['special-quad']
    );

    // Exposed meat quad of 化 (10) + SAO of 上 (6) + two meat kous (4) = 20 fu.
    expectReward(
        '20 fu scores 1 reward',
        [
            ...cards(0, 0, 3),
            ...kou(1, 0, 1),
            ...kou(0, 1, 2),
            ...chi(4),
            ...chi(6)
        ],
        [{ type: 'XIA-CE', cards: cards(2, 0, 4) }],
        null,
        {},
        1,
        ['score-20']
    );

    expectReward(
        'All meat scores 1 reward',
        [
            ...kou(0, 0, 1),
            ...kou(1, 0, 1),
            ...chi(0),
            ...chi(1),
            ...chi(2),
            ...chi(2)
        ],
        [],
        null,
        {},
        1,
        ['all-meat']
    );

    expectReward(
        'All red is a big red worth 3',
        [
            ...cards(4, 0, 3),
            ...kou(0, 0, 1),
            ...kou(2, 0, 1),
            ...chi(0),
            ...chi(2),
            ...chi(6)
        ],
        [],
        null,
        {},
        3,
        ['big-red']
    );

    expectReward(
        'All black is a big black worth 4',
        [
            ...cards(5, 0, 3),
            ...kou(5, 1, 2),
            ...kou(7, 1, 2),
            ...chi(3),
            ...chi(7)
        ],
        [{ type: 'XIA-CE', cards: cards(1, 0, 4) }],
        null,
        {},
        4,
        ['big-black']
    );

    expectReward(
        'All meat and all red stack',
        [
            ...kou(0, 0, 1),
            ...kou(2, 0, 1),
            ...chi(0),
            ...chi(2),
            ...chi(0),
            ...chi(2)
        ],
        [],
        null,
        {},
        4,
        ['all-meat', 'big-red']
    );

    expectReward(
        'All veggie and all black stack',
        [
            ...kou(3, 0, 1),
            ...kou(5, 0, 1),
            ...chi(3),
            ...chi(5),
            ...chi(7),
            ...chi(7)
        ],
        [],
        null,
        {},
        5,
        ['all-veggie', 'big-black']
    );

    expectReward(
        'Dragon, 20 fu, and four 上 stack',
        [
            ...cards(0, 0, 4),
            card(0, 1),
            card(0, 2),
            ...kou(1, 0, 1),
            ...kou(2, 0, 1),
            ...chi(4),
            ...chi(6)
        ],
        [],
        null,
        {},
        4,
        ['score-20', 'dragon-snake', 'special-quad']
    );

    const shot = buildScreenshotHarmonyState();
    expectReward(
        'All-veggie screenshot hand scores 1 reward',
        shot.hand,
        shot.exposed,
        shot.activeCard,
        {},
        1,
        ['all-veggie']
    );

    // Four of both 上 and 七 is still one special-quad bonus, worth 2, plus 20 fu.
    {
        const reward = Rules.calculateRewards(
            [
                ...kou(1, 0, 1),
                ...kou(2, 0, 1),
                ...chi(4),
                ...chi(5)
            ],
            [
                { type: 'XIA-CE', cards: cards(0, 0, 4) },
                { type: 'XIA-CE', cards: cards(3, 0, 4) }
            ],
            null,
            {}
        );
        assert(
            'Two special quads still add one bonus, worth 2',
            reward.points !== undefined
                && reward.total === 3
                && reward.reasons.filter(r => r === 'special-quad').length === 1,
            `reasons=${(reward.reasons || []).join(', ')} total=${reward.total} points=${reward.points}`
        );
    }

    {
        const game = createBareGame();
        const stateHand = [
            ...kou(0, 0, 1),
            ...kou(1, 0, 1),
            ...chi(2),
            ...chi(5),
            card(3, 0),
            card(3, 1)
        ];
        game.players[0].hand = stateHand;
        game.players[0].exposed = [{ type: 'SAO', cards: cards(4, 0, 3) }];
        const active = card(3, 2);
        game.activeCard = active;

        game.currentPlayerIndex = 0;
        game.activeCardSource = 'DECK';
        const selfTypes = (game.calculateActions(active).get(0) || []).map(a => a.type);
        assert(
            'Self-draw offers Harmony on an 11-fu hand',
            selfTypes.includes('HARMONY'),
            `Got: ${selfTypes.join(', ')}`
        );

        game.currentPlayerIndex = 1;
        game.activeCardSource = 'DECK';
        const otherTypes = (game.calculateActions(active).get(0) || []).map(a => a.type);
        assert(
            'Another player drawing the same card does not offer Harmony',
            !otherTypes.includes('HARMONY'),
            `Got: ${otherTypes.join(', ')}`
        );

        game.currentPlayerIndex = 0;
        game.activeCardSource = 2;
        const passedTypes = (game.calculateActions(active).get(0) || []).map(a => a.type);
        assert(
            'A passed card is not a self-draw and does not offer Harmony',
            !passedTypes.includes('HARMONY'),
            `Got: ${passedTypes.join(', ')}`
        );
    }

    {
        const game = createBareGame();
        game.endGame({ winner: game.players[0], rewards: 3 });
        assert(
            'Winner keeps the hand reward and a win',
            game.players[0].wins === 1 && game.players[0].totalRewards === 3
                && game.players[1].wins === 0 && game.players[1].totalRewards === 0
                && game.players[2].totalRewards === 0
                && game.players.every(p => p.totalGames === 1),
            `wins=${game.players.map(p => p.wins).join(',')} rewards=${game.players.map(p => p.totalRewards).join(',')}`
        );

        game.endGame({ winner: null, special: 'BAO-ZI', triggerPlayer: game.players[0] });
        assert(
            '[RULE-BAO-ZI] Baozi gives the other two players a win and 1 reward (大) each',
            game.players[0].wins === 1 && game.players[0].totalRewards === 3
                && game.players[1].wins === 1 && game.players[1].totalRewards === 1
                && game.players[2].wins === 1 && game.players[2].totalRewards === 1,
            `wins=${game.players.map(p => p.wins).join(',')} rewards=${game.players.map(p => p.totalRewards).join(',')}`
        );
    }

    {
        const game = createBareGame();
        const locked = game.players[1];
        locked.hand = chi(0);
        assert(
            '[RULE-BAO-ZI] A must-meld with no legal discard is baozi and awards 1大 to each winner',
            game.declareBaoziIfNoLegalDiscard(locked) === true
                && locked.wins === 0 && locked.totalRewards === 0
                && game.players[0].wins === 1 && game.players[0].totalRewards === 1
                && game.players[2].wins === 1 && game.players[2].totalRewards === 1,
            `wins=${game.players.map(p => p.wins).join(',')} rewards=${game.players.map(p => p.totalRewards).join(',')}`
        );
    }

    {
        const game = createBareGame();
        const trigger = game.players[2];
        const c1 = card(0, 0); // 上
        const c2 = card(0, 1); // 大
        const incoming = card(0, 2); // 人
        trigger.hand = [c1, c2]; // 0 cards remain after forming CHI
        game.executeBotMeld(2, incoming, { type: 'CHI', cards: [c1, c2] });
        assert(
            '[RULE-BAO-ZI] Completing a meld with 0 cards left in hand triggers baozi and gives 1大 to each non-trigger player',
            trigger.hand.length === 0
                && trigger.wins === 0 && trigger.totalRewards === 0
                && game.players[0].wins === 1 && game.players[0].totalRewards === 1
                && game.players[1].wins === 1 && game.players[1].totalRewards === 1,
            `wins=${game.players.map(p => p.wins).join(',')} rewards=${game.players.map(p => p.totalRewards).join(',')}`
        );
    }

    {
        const game = createBareGame();
        game.players[0].hand = [...chi(0), card(3, 0)];
        assert(
            'A legal spare card is not baozi',
            game.declareBaoziIfNoLegalDiscard(game.players[0]) === false
                && game.players[0].totalGames === 0,
            `games=${game.players[0].totalGames}`
        );
    }

    {
        const game = createBareGame();
        const state = buildScreenshotHarmonyState();
        game.players[0].hand = [...state.hand, state.activeCard];
        game.players[0].exposed = state.exposed;
        const lines = [];
        game.log = (msg) => lines.push(msg);
        const won = game.finishHarmonyIfWon(game.players[0]);
        assert(
            'Harmony log lists the reward keys',
            won && lines.some(line => line === 'You declares HARMONY! Rewards: 1 [all-veggie]'),
            lines.join(' | ')
        );
    }

    if (failed > 0) {
        console.error(`${failed} reward test(s) failed.`);
        process.exit(1);
    }
    console.log('All reward tests passed successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runRewardTests();
}
