import { Game } from './src/js/game.js';
import { Player } from './src/js/player.js';
import { Card } from './src/js/card.js';
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
