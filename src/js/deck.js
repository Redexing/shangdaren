import { Card, ALL_SUITES } from './card.js';
import { getFreshSeed } from './utils.js';

export class Deck {
    constructor(seedVal = null) {
        this.cards = [];
        this.seed = seedVal !== null ? seedVal >>> 0 : getFreshSeed();
        console.log(`[DECK] Initializing with seed: ${this.seed}`);
        this.initialize();
        this.shuffle();
    }

    initialize() {
        this.cards = [];
        let idCounter = 0;
        // 8 Suites
        for (let s = 0; s < ALL_SUITES.length; s++) {
            // 3 Characters per suite
            for (let c = 0; c < 3; c++) {
                // 4 Copies of each card
                for (let k = 0; k < 4; k++) {
                    this.cards.push(new Card(idCounter++, s, c));
                }
            }
        }
    }

    // Instance-level PRNG to avoid global mutation traps
    nextRandom() {
        this.seed = (this.seed + 0x6D2B79F5) | 0;
        let t = Math.imul(this.seed ^ (this.seed >>> 15), this.seed | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    shuffle() {
        const initialTop = this.cards[this.cards.length - 1]?.toString();

        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(this.nextRandom() * (i + 1));
            // Standard swap
            const temp = this.cards[i];
            this.cards[i] = this.cards[j];
            this.cards[j] = temp;
        }

        const finalTop = this.cards[this.cards.length - 1]?.toString();
        console.log(`[DECK] Shuffle complete. Top card: ${finalTop} (was ${initialTop})`);
    }

    draw() {
        return this.cards.pop();
    }

    isEmpty() {
        return this.cards.length === 0;
    }

    remaining() {
        return this.cards.length;
    }
}
