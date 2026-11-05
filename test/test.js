import { Game } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import { Rules } from '../src/js/rules.js';
import { Card } from '../src/js/card.js';
import { runGetActionsTests } from './test_get_actions.js';
import { runHarmonyTests } from './test_harmony.js';
import { runHarmonyActionTests } from './test_harmony_actions.js';
import { runRewardTests } from './test_rewards.js';
import { runFlowTests } from './test_flow.js';
import { runVoiceTests } from './test_voice.js';

// Setup Mock Listeners
const game = new Game();
game.on('log', (msg) => console.log('[GAME]:', msg));
game.on('state_change', () => {
    console.log('[STATE]: Phase:', game.turnPhase);
});

// Run Init
game.init();
// Cancel async turn timer from game.init() so test runner exits cleanly without stray logs
game.flowToken++;

// [RULE-DECK-SIZE], [RULE-PLAYER-COUNT], [RULE-INITIAL-DEAL]
if (game.players.length !== 3) {
    console.error('ERROR: Incorrect player count');
    process.exit(1);
}
if (game.players.every(p => p.hand.length === 15) && game.deck.remaining() === 51) {
    console.log('Player 0 hand size:', game.players[0].hand.length);
    console.log('Hand size and deck deal check passed.');
} else {
    console.error('ERROR: Incorrect hand size or remaining deck size');
    process.exit(1);
}

// Simulate a Turn Sequence if possible
// The game starts async with setTimeout. Node will exit unless we keep it open?
// Or we mock setTimeout
// For testing, we can manually trigger flow.

// Test Rules logic
console.log('Testing Rules...');
// Create fake hand for testing
const cardA = game.deck.cards[0]; // e.g. Shang (Red)
const cardB = game.deck.cards[1];
const cardC = game.deck.cards[2];
// Assuming they are distinct?
// Deck is shuffled.

// ...

// Test canDiscard (Redundant card logic)
console.log('Testing canDiscard...');
const s0c0 = new Card(100, 0, 0); // 上
const s0c1a = new Card(101, 0, 1); // 大
const s0c1b = new Card(102, 0, 1); // 大
const s0c2 = new Card(103, 0, 2); // 人

// [上, 大, 大, 人]
const hand1 = [s0c0, s0c1a, s0c1b, s0c2];
if (Rules.canDiscard(hand1, 1) === true && Rules.canDiscard(hand1, 0) === false) {
    console.log('canDiscard (redundant middle) passed.');
} else {
    console.error('canDiscard (redundant middle) FAILED.');
}

// [上, 上, 大, 人]
const hand2 = [s0c0, new Card(104, 0, 0), s0c1a, s0c2];
if (Rules.canDiscard(hand2, 0) === true && Rules.canDiscard(hand2, 2) === false) {
    console.log('canDiscard (redundant first) passed.');
} else {
    console.error('canDiscard (redundant first) FAILED.');
}

// [上, 大, 人, 人]
const hand3 = [s0c0, s0c1a, s0c2, new Card(105, 0, 2)];
if (Rules.canDiscard(hand3, 2) === true && Rules.canDiscard(hand3, 1) === false) {
    console.log('canDiscard (redundant last) passed.');
} else {
    console.error('canDiscard (redundant last) FAILED.');
}

// [大, 大, 大]
const hand4 = [s0c1a, s0c1b, new Card(106, 0, 1)];
if (Rules.canDiscard(hand4, 0) === false) {
    console.log('canDiscard (triple) passed.');
} else {
    console.error('canDiscard (triple) FAILED.');
    process.exit(1);
}

// [尔, 尔, 尔, 小, 生]: the trip stays whole, so 小 and 生 are a KOU.
const erTrip = [new Card(120, 4, 0), new Card(121, 4, 0), new Card(122, 4, 0)];
const xiao = new Card(123, 4, 1);
const sheng = new Card(124, 4, 2);
const handKouBesideTrip = [...erTrip, xiao, sheng];
const xiaoIdx = handKouBesideTrip.indexOf(xiao);
const shengIdx = handKouBesideTrip.indexOf(sheng);
if (
    Rules.canDiscard(handKouBesideTrip, 0) === false
    && Rules.canDiscard(handKouBesideTrip, xiaoIdx) === true
    && Rules.canDiscard(handKouBesideTrip, shengIdx) === true
) {
    console.log('canDiscard (KOU beside trip) passed.');
} else {
    console.error('canDiscard (KOU beside trip) FAILED.');
    process.exit(1);
}

// Four 尔 are a quad, not CHI material. 小 and 生 stay discardable.
const handKouBesideQuad = [...erTrip, new Card(125, 4, 0), xiao, sheng];
if (
    Rules.canDiscard(handKouBesideQuad, 0) === false
    && Rules.canDiscard(handKouBesideQuad, handKouBesideQuad.indexOf(xiao)) === true
    && Rules.canDiscard(handKouBesideQuad, handKouBesideQuad.indexOf(sheng)) === true
) {
    console.log('canDiscard (KOU beside quad) passed.');
} else {
    console.error('canDiscard (KOU beside quad) FAILED.');
    process.exit(1);
}

// [尔, 尔, 小, 生] is a real CHI plus a spare 尔. 小 and 生 stay locked.
const realChi = [new Card(126, 4, 0), new Card(127, 4, 0), xiao, sheng];
if (
    Rules.canDiscard(realChi, 0) === true
    && Rules.canDiscard(realChi, realChi.indexOf(xiao)) === false
    && Rules.canDiscard(realChi, realChi.indexOf(sheng)) === false
) {
    console.log('canDiscard (real CHI still locks partners) passed.');
} else {
    console.error('canDiscard (real CHI still locks partners) FAILED.');
    process.exit(1);
}

// [RULE-NAKED-QUAD-REVEAL]: findNakedQuadInHand detects naked 4-of-a-kind vs non-naked 4-of-a-kind
const quadCards = [new Card(110, 3, 0), new Card(111, 3, 0), new Card(112, 3, 0), new Card(113, 3, 0)];
const nakedQuadRes = Rules.findNakedQuadInHand([...quadCards, s0c0]);
const nonNakedQuadRes = Rules.findNakedQuadInHand([...quadCards, new Card(114, 3, 1)]);
if (nakedQuadRes && nakedQuadRes.length === 4 && nonNakedQuadRes === null) {
    console.log('findNakedQuadInHand check passed.');
} else {
    console.error('findNakedQuadInHand check FAILED.');
    process.exit(1);
}

runGetActionsTests();
runHarmonyTests();
runHarmonyActionTests();
runRewardTests();
runFlowTests();
runVoiceTests();

// Verify Player stats storage gracefully handles headless environment
const testPlayer = new Player('HeadlessPlayer');
testPlayer.wins = 3;
testPlayer.totalGames = 10;
testPlayer.saveStats();
testPlayer.loadStats();
console.log('Player headless stats test passed.');

console.log('Basic game structure and rules are valid.');
