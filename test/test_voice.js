import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SUITES_DATA } from '../src/js/card.js';
import { Card } from '../src/js/card.js';
import { Deck } from '../src/js/deck.js';
import { TRANSLATIONS } from '../src/js/translations.js';
import { Game, EVENTS } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import {
    CARD_LINES,
    PERSONA_ORDER,
    VOICE_LINES,
    lineIdForAction,
    lineIdForGlyph,
    personaForSeat
} from '../src/js/voice_lines.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
    console.error(msg);
    process.exit(1);
}

const glyphs = SUITES_DATA.flat();
if (CARD_LINES.length !== glyphs.length) {
    fail(`CARD_LINES length ${CARD_LINES.length}, expected ${glyphs.length}`);
}
glyphs.forEach((glyph, i) => {
    if (CARD_LINES[i].glyph !== glyph) fail(`CARD_LINES[${i}] is not ${glyph}`);
    if (CARD_LINES[i].lineId !== lineIdForGlyph(glyph)) fail(`line id mismatch for ${glyph}`);
});

const cardIds = CARD_LINES.map(line => line.lineId);
if (new Set(cardIds).size !== cardIds.length) fail('Two card glyphs share a clip id');

const harmony = VOICE_LINES.find(line => line.type === 'HARMONY');
if (!harmony || harmony.spoken !== '糊了' || harmony.lineId !== 'hu-le') {
    fail('HARMONY must speak 糊了 as hu-le');
}
if (lineIdForAction('PASS') !== 'bu-yao') fail('PASS must speak bu-yao');

const meldKeys = [
    'CHI', 'KOU', 'PENG', 'SAO', 'XIA-CE', 'KAI-ZAO',
    'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE', 'TWO-DRAGONS-TUSSLING',
    'HARMONY', 'PASS'
];
meldKeys.forEach(type => {
    if (!TRANSLATIONS.zh[type]) fail(`Missing zh translation for ${type}`);
    if (!lineIdForAction(type)) fail(`Missing spoken line for ${type}`);
});

PERSONA_ORDER.forEach(persona => {
    VOICE_LINES.forEach(line => {
        const file = path.join(root, 'src', 'audio', persona, `${line.lineId}.mp3`);
        if (!fs.existsSync(file) || fs.statSync(file).size < 200) {
            fail(`Missing clip ${persona}/${line.lineId}.mp3`);
        }
    });
});

const seats = {
    xiaoxiao: ['xiaoxiao', 'xiaoxuan', 'yunyang'],
    xiaoxuan: ['xiaoxuan', 'xiaoxiao', 'yunyang'],
    yunyang: ['yunyang', 'xiaoxiao', 'xiaoxuan']
};
Object.entries(seats).forEach(([voice, expected]) => {
    expected.forEach((persona, seat) => {
        if (personaForSeat(voice, seat) !== persona) {
            fail(`Seat ${seat} for ${voice} should be ${persona}`);
        }
    });
});
if (personaForSeat('none', 0) !== null || personaForSeat('none', 2) !== null) {
    fail('关闭 must silence every seat');
}

function listen(game) {
    const calls = [];
    game.on(EVENTS.VOICE_CALL, (event) => calls.push(event));
    return calls;
}

function freshGame() {
    const game = new Game();
    game.players = [
        new Player('You', true),
        new Player('Bot Left', false),
        new Player('Bot Right', false)
    ];
    game.isWatchMode = false;
    return game;
}

const drawGame = freshGame();
drawGame.deck = new Deck(1);
drawGame.currentPlayerIndex = 0;
const top = drawGame.deck.cards[drawGame.deck.cards.length - 1];
const drawCalls = listen(drawGame);
drawGame.drawCard();
drawGame.flowToken++;
if (drawCalls.length !== 1
    || drawCalls[0].playerIndex !== 0
    || drawCalls[0].lineId !== lineIdForGlyph(top.character)) {
    fail(`Draw should name the shown card, got ${JSON.stringify(drawCalls)}`);
}

const passGame = freshGame();
const passCalls = listen(passGame);
const passed = new Card(900, 3, 1);
passGame.currentPlayerIndex = 0;
passGame.activeCard = passed;
passGame.activeCardSource = 'DECK';
passGame.pendingActions = new Map();
passGame.handlePass(0, passed);
passGame.flowToken++;
if (passCalls.length !== 0) {
    fail(`A fresh-card pass must stay silent, got ${JSON.stringify(passCalls)}`);
}

passGame.currentPlayerIndex = 1;
passGame.activeCard = passed;
passGame.activeCardSource = 0;
passGame.pendingActions = new Map();
passGame.handlePass(1, passed);
passGame.flowToken++;
if (passCalls.length !== 1 || passCalls[0].playerIndex !== 1 || passCalls[0].lineId !== 'bu-yao') {
    fail(`Downstream decline must say bu-yao, got ${JSON.stringify(passCalls)}`);
}

const interruptGame = freshGame();
const interruptCalls = listen(interruptGame);
interruptGame.currentPlayerIndex = 0;
interruptGame.turnPhase = 'DRAWING';
interruptGame.activeCard = passed;
interruptGame.activeCardSource = 'DECK';
interruptGame.pendingActions = new Map([[0, [{ type: 'PASS', cards: [] }]]]);
interruptGame.handlePass(2, passed);
interruptGame.flowToken++;
if (interruptCalls.length !== 0) {
    fail(`An interrupt decline must stay silent, got ${JSON.stringify(interruptCalls)}`);
}

console.log('Voice line catalog and call timing passed.');

export function runVoiceTests() {
    // Imported for the suite runner. The checks above already ran.
}
