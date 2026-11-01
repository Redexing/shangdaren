import { UI_DELAYS } from './constants.js';
import {
    DEFAULT_SOUND_VOICE,
    isCardLine,
    normalizeSoundVoice,
    personaForSeat
} from './voice_lines.js';

const STORAGE_KEY = 'soundVoice';

let audioCtx = null;
let queue = [];
let playing = false;
let gapTimer = null;
const buffers = new Map();

export function currentSoundVoice() {
    try {
        return normalizeSoundVoice(localStorage.getItem(STORAGE_KEY));
    } catch {
        return DEFAULT_SOUND_VOICE;
    }
}

export function unlockVoice() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

export function setSoundVoice(value) {
    const next = normalizeSoundVoice(value);
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // Private mode can refuse storage. The select still shows the choice.
    }
    if (next === 'none') {
        queue = [];
        if (gapTimer) {
            clearTimeout(gapTimer);
            gapTimer = null;
        }
    }
}

function clipUrl(persona, lineId) {
    return new URL(`../audio/${persona}/${lineId}.mp3`, import.meta.url);
}

async function loadBuffer(persona, lineId) {
    const key = `${persona}/${lineId}`;
    if (buffers.has(key)) return buffers.get(key);
    const response = await fetch(clipUrl(persona, lineId));
    if (!response.ok) throw new Error(`Missing voice clip ${key}`);
    const data = await response.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(data);
    buffers.set(key, buffer);
    return buffer;
}

function finishOrContinue() {
    if (currentSoundVoice() === 'none') {
        queue = [];
        playing = false;
        return;
    }
    if (queue.length === 0) {
        playing = false;
        return;
    }
    gapTimer = setTimeout(() => {
        gapTimer = null;
        playNext();
    }, UI_DELAYS.VOICE_GAP);
}

async function playNext() {
    if (currentSoundVoice() === 'none') {
        queue = [];
        playing = false;
        return;
    }
    const item = queue.shift();
    if (!item) {
        playing = false;
        return;
    }
    playing = true;
    const persona = personaForSeat(currentSoundVoice(), item.playerIndex);
    if (!persona || !audioCtx) {
        finishOrContinue();
        return;
    }
    try {
        const buffer = await loadBuffer(persona, item.lineId);
        if (currentSoundVoice() === 'none') {
            queue = [];
            playing = false;
            return;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => finishOrContinue();
        source.start();
    } catch (err) {
        console.error('[VOICE]', err);
        finishOrContinue();
    }
}

export function enqueueVoiceCall({ playerIndex, lineId }) {
    if (currentSoundVoice() === 'none') return;
    if (personaForSeat(currentSoundVoice(), playerIndex) === null) return;
    const item = { playerIndex, lineId };
    if (isCardLine(lineId)) {
        // The card on the table replaces any call that has not started.
        queue = [item];
    } else {
        queue.push(item);
    }
    if (!playing) playNext();
}
