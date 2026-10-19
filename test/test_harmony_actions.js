import { Game } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import { Card } from '../src/js/card.js';
import { Rules } from '../src/js/rules.js';
import { buildScreenshotHarmonyState } from './test_harmony.js';

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
    return game;
}

function loadScreenshotHand(game) {
    const state = buildScreenshotHarmonyState();
    game.players[0].hand = state.hand;
    game.players[0].exposed = state.exposed;
    game.players[1].hand = [];
    game.players[2].hand = [];
    return state.activeCard;
}

function actionTypesFor(game, card, playerIndex) {
    const actionMap = game.calculateActions(card);
    const actions = actionMap.get(playerIndex) || [];
    return actions.map(a => a.type);
}

export function runHarmonyActionTests() {
    console.log('Running Harmony action trigger tests...');

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

    {
        const game = createBareGame();
        const zuo = loadScreenshotHand(game);
        game.currentPlayerIndex = 1; // Bot Left drew 作
        game.activeCard = zuo;
        game.activeCardSource = 'DECK';

        const types = actionTypesFor(game, zuo, 0);
        assert(
            'Downstream draw (left) offers Harmony as a choice',
            types.includes('HARMONY') && types.includes('PASS'),
            `Got: ${types.join(', ')}`
        );
        assert(
            'Downstream draw does not force CHI on the winning tile',
            !types.includes('CHI'),
            `Got: ${types.join(', ')}`
        );
    }

    {
        const game = createBareGame();
        const zuo = loadScreenshotHand(game);
        game.currentPlayerIndex = 2; // Bot Right (upstream) drew 作
        game.activeCard = zuo;
        game.activeCardSource = 'DECK';

        const types = actionTypesFor(game, zuo, 0);
        assert(
            'Upstream draw (right) makes Harmony a must action',
            types.includes('HARMONY') && !types.includes('PASS'),
            `Got: ${types.join(', ')}`
        );
    }

    {
        const game = createBareGame();
        const zuo = loadScreenshotHand(game);
        game.currentPlayerIndex = 0; // You drew 作
        game.activeCard = zuo;
        game.activeCardSource = 'DECK';

        const types = actionTypesFor(game, zuo, 0);
        assert(
            'Self-draw makes Harmony a must action',
            types.includes('HARMONY') && !types.includes('PASS'),
            `Got: ${types.join(', ')}`
        );
    }

    {
        const game = createBareGame();
        const zuo = loadScreenshotHand(game);
        game.currentPlayerIndex = 0;
        game.activeCard = zuo;
        game.activeCardSource = 2; // passed from upstream (right)

        const types = actionTypesFor(game, zuo, 0);
        assert(
            'Passed winning tile from upstream makes Harmony a must action',
            types.includes('HARMONY') && !types.includes('PASS'),
            `Got: ${types.join(', ')}`
        );
    }

    {
        // Meat hand with 9 fu cannot Harmony, so CHI on an exposed meat KOU stays a normal meld.
        const game = createBareGame();
        game.players[0].hand = [
            new Card(1, 3, 0),
            new Card(2, 3, 1)
        ];
        game.players[0].exposed = [{
            type: 'KOU',
            cards: [new Card(3, 0, 0), new Card(4, 0, 2)] // 上, 人
        }];
        const incoming = new Card(5, 0, 1); // 大
        game.currentPlayerIndex = 1;
        game.activeCard = incoming;
        game.activeCardSource = 'DECK';

        const types = actionTypesFor(game, incoming, 0);
        assert(
            'Downstream meat draw without Harmony does not offer Harmony',
            !types.includes('HARMONY'),
            `Got: ${types.join(', ')}`
        );
    }

    {
        // Passed tile to receiver (isSelf=true, isSelfDraw=false) upgrades exposed Veggie SAO + 1 same-suit hand card
        // into HALF-DRAGON (8 Fu) + Meat KOU (2 Fu) = 10 Fu (exact-10 reward).
        // Must offer mandatory HARMONY rather than scoring as HALF-SNAKE (6 Fu) and missing the 10-Fu gate.
        const game = createBareGame();
        let cid = 900;
        const c = (s, ch) => new Card(cid++, s, ch);
        game.players[0].exposed = [
            { type: 'SAO', cards: [c(4, 0), c(4, 0), c(4, 0)] } // 尔x3
        ];
        game.players[0].hand = [
            c(4, 1),          // 小 (combines with SAO + 4th 尔 -> HALF-DRAGON = 8 Fu, 1st KOU)
            c(0, 0), c(0, 1), // 上, 大 (Meat KOU = 2 Fu, 2nd KOU)
            c(3, 0), c(3, 1), c(3, 2), // Veggie CHI (0 Fu)
            c(5, 0), c(5, 1), c(5, 2), // Veggie CHI (0 Fu)
            c(6, 0), c(6, 1), c(6, 2)  // Veggie CHI (0 Fu)
        ];
        const fourthEr = c(4, 0);
        game.currentPlayerIndex = 0; // Receiver after upstream pass
        game.activeCard = fourthEr;
        game.activeCardSource = 2;   // Passed from upstream (not DECK)

        const types = actionTypesFor(game, fourthEr, 0);
        assert(
            'Passed tile upgrading SAO to HALF-DRAGON (10 Fu) offers mandatory HARMONY',
            types.includes('HARMONY') && types.includes('HALF-DRAGON') && !types.includes('PASS'),
            `Got: ${types.join(', ')}`
        );

        // Interrupter (isSelf=false) with the same cards gets HALF-SNAKE (6 Fu + 2 Fu = 8 Fu < 10 Fu) -> no HARMONY
        const interrupterMoves = Rules.getActions(
            game.players[0].hand,
            fourthEr,
            false,
            game.players[0].exposed
        ).map(m => m.type);
        assert(
            'Interrupter (isSelf=false) scores upgrade as HALF-SNAKE (8 Fu) and does not offer HARMONY',
            interrupterMoves.includes('HALF-SNAKE') && !interrupterMoves.includes('HARMONY'),
            `Got: ${interrupterMoves.join(', ')}`
        );
    }

    {
        // Passed tile to receiver (isSelf=true, isSelfDraw=false) upgrades exposed Veggie HALF-DRAGON
        // into DRAGON (8 Fu) + Meat KOU (2 Fu) = 10 Fu (meets 10-Fu gate, dragon-snake + exact-10).
        const game = createBareGame();
        let cid = 950;
        const c = (s, ch) => new Card(cid++, s, ch);
        game.players[0].exposed = [
            { type: 'HALF-DRAGON', cards: [c(4, 0), c(4, 0), c(4, 0), c(4, 0), c(4, 1)] } // 尔x4 + 小
        ];
        game.players[0].hand = [
            c(0, 0), c(0, 1),          // Meat KOU (2 Fu)
            c(3, 0), c(3, 1),          // Veggie KOU (0 Fu)
            c(5, 0), c(5, 1), c(5, 2), // Veggie CHI (0 Fu)
            c(6, 0), c(6, 1), c(6, 2)  // Veggie CHI (0 Fu)
        ];
        const sheng = c(4, 2); // 生 completes DRAGON (8 Fu)
        game.currentPlayerIndex = 0;
        game.activeCard = sheng;
        game.activeCardSource = 2; // Passed from upstream

        const types = actionTypesFor(game, sheng, 0);
        assert(
            'Passed tile upgrading HALF-DRAGON to DRAGON (10 Fu) offers mandatory HARMONY',
            types.includes('HARMONY') && types.includes('DRAGON') && !types.includes('PASS'),
            `Got: ${types.join(', ')}`
        );

        const logs = [];
        game.log = (msg) => logs.push(msg);
        game.handleHarmony(0, sheng);
        game.flowToken++; // Cancel celebration timer
        assert(
            'handleHarmony on passed tile scores DRAGON upgrade (exact-10, dragon-snake) without self-draw',
            game.players[0].exposed.some(m => m.type === 'DRAGON')
                && logs.some(l => l.includes('Rewards: 2 [exact-10, dragon-snake]')),
            `exposed=${game.players[0].exposed.map(m => m.type).join(',')} logs=${logs.join(' | ')}`
        );
    }

    if (failed > 0) {
        console.error(`${failed} Harmony action test(s) failed.`);
        process.exit(1);
    } else {
        console.log('All Harmony action tests passed successfully!');
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runHarmonyActionTests();
}
