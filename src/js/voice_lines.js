import { SUITES_DATA } from './card.js';

// Seat 0's choice, then the other two personas in this order.
export const PERSONA_ORDER = ['xiaoxiao', 'xiaoxuan', 'yunyang'];

export const DEFAULT_SOUND_VOICE = 'xiaoxiao';

export const SOUND_OPTIONS = [
    { value: 'xiaoxiao', labelKey: 'Xiaoxiao' },
    { value: 'xiaoxuan', labelKey: 'Xiaoxuan' },
    { value: 'yunyang', labelKey: 'Yunyang' },
    { value: 'none', labelKey: 'Off' }
];

const CALL_LINES = [
    { type: 'CHI', spoken: '吃', reading: 'chī', lineId: 'chi' },
    { type: 'KOU', spoken: '口', reading: 'kǒu', lineId: 'kou' },
    { type: 'PENG', spoken: '碰', reading: 'pèng', lineId: 'peng' },
    { type: 'SAO', spoken: '绍', reading: 'shào', lineId: 'shao' },
    { type: 'XIA-CE', spoken: '下扯', reading: 'xià chě', lineId: 'xia-che' },
    { type: 'KAI-ZAO', spoken: '开招', reading: 'kāi zhāo', lineId: 'kai-zhao' },
    { type: 'DRAGON', spoken: '龙', reading: 'lóng', lineId: 'long' },
    { type: 'SNAKE', spoken: '蛇', reading: 'shé', lineId: 'she' },
    { type: 'HALF-DRAGON', spoken: '半龙', reading: 'bàn lóng', lineId: 'ban-long' },
    { type: 'HALF-SNAKE', spoken: '半蛇', reading: 'bàn shé', lineId: 'ban-she' },
    { type: 'TWO-DRAGONS-TUSSLING', spoken: '双龙抱柱', reading: 'shuāng lóng bào zhù', lineId: 'shuang-long-bao-zhu' },
    { type: 'HARMONY', spoken: '糊了', reading: 'hú le', lineId: 'hu-le' },
    { type: 'PASS', spoken: '不要', reading: 'bú yào', lineId: 'bu-yao' }
];

function hexId(glyph) {
    return glyph.codePointAt(0).toString(16);
}

export const CARD_LINES = SUITES_DATA.flat().map(glyph => ({
    glyph,
    lineId: hexId(glyph),
    kind: 'card'
}));

export const VOICE_LINES = [
    ...CARD_LINES,
    ...CALL_LINES.map(line => ({ ...line, kind: 'call' }))
];

const CARD_LINE_IDS = new Set(CARD_LINES.map(line => line.lineId));
const CALLS_BY_TYPE = new Map(CALL_LINES.map(line => [line.type, line]));

export function lineIdForGlyph(glyph) {
    return hexId(glyph);
}

export function lineIdForAction(type) {
    const line = CALLS_BY_TYPE.get(type);
    return line ? line.lineId : null;
}

export function isCardLine(lineId) {
    return CARD_LINE_IDS.has(lineId);
}

export function normalizeSoundVoice(value) {
    return SOUND_OPTIONS.some(option => option.value === value) ? value : DEFAULT_SOUND_VOICE;
}

// null means the whole table is silent.
export function personaForSeat(soundVoice, seatIndex) {
    const voice = normalizeSoundVoice(soundVoice);
    if (voice === 'none') return null;
    const rest = PERSONA_ORDER.filter(id => id !== voice);
    const seats = [voice, rest[0], rest[1]];
    return seats[seatIndex] ?? null;
}
