
import { ALL_SUITES } from './card.js';

export const SCORE_THRESHOLD = 10;

export class Rules {
    static getSuite(card) {
        return card.suiteIndex;
    }

    static isRed(card) {
        return card.isRed;
    }

    static isMeat(suiteIndex) {
        return suiteIndex < 3;
    }

    // Check if cards form a valid Suite (Sequence of 3 in same suite: 0, 1, 2)
    static isCompleteSuite(cards) {
        if (cards.length !== 3) return false;
        const s = cards[0].suiteIndex;
        if (!cards.every(c => c.suiteIndex === s)) return false;

        const chars = cards.map(c => c.characterIndex).sort();
        return chars[0] === 0 && chars[1] === 1 && chars[2] === 2;
    }

    static isTrip(cards) {
        if (cards.length !== 3) return false;
        const type = cards[0].typeId;
        return cards.every(c => c.typeId === type);
    }

    static isQuad(cards) {
        if (cards.length !== 4) return false;
        const type = cards[0].typeId;
        return cards.every(c => c.typeId === type);
    }

    static canCompleteKou(kouCards, card) {
        if (kouCards.length !== 2) return false;
        if (kouCards[0].suiteIndex !== card.suiteIndex) return false;
        const indices = kouCards.map(c => c.characterIndex);
        return !indices.includes(card.characterIndex);
    }

    /**
     * Scoring Rules:
     * 1. MEAT CHI: 3 points; VEGGIE CHI: 0 points.
     * 2. MEAT KOU: 2 points; VEGGIE KOU: 0 points.
     * 3. SAO/SNAKE: MEAT 6/14, VEGGIE 4/6.
     * 4. PENG/DRAGON: MEAT 3/16, VEGGIE 2/8.
     * 5. KAI-ZAO/HALF-SNAKE: MEAT 12/12, VEGGIE 8/6.
     * 6. XIA-CE/HALF-DRAGON: MEAT 10/14, VEGGIE 6/8.
     */
    static calculateTotalPoints(exposed = []) {
        let total = 0;
        exposed.forEach(meld => {
            const isMeat = this.isMeat(meld.cards[0].suiteIndex);
            switch (meld.type) {
                case 'CHI':
                case 'JU':
                case 'SUITE':
                    if (isMeat) total += 3;
                    break;
                case 'KOU':
                    if (isMeat) total += 2;
                    break;
                case 'SAO':
                case 'KAI-ZAO_HAND':
                    total += isMeat ? 6 : 4;
                    break;
                case 'PENG':
                    total += isMeat ? 3 : 2;
                    break;
                case 'KAI-ZAO':
                case 'SAO_GANG':
                case 'GANG_4_HAND':
                    total += isMeat ? 12 : 8;
                    break;
                case 'XIA-CE':
                case 'GANG':
                case 'PENG_GANG':
                    total += isMeat ? 10 : 6;
                    break;
                case 'DRAGON':
                    total += isMeat ? 16 : 8;
                    break;
                case 'HALF-DRAGON':
                    total += isMeat ? 14 : 8;
                    break;
                case 'SNAKE':
                    total += isMeat ? 14 : 6;
                    break;
                case 'HALF-SNAKE':
                    total += isMeat ? 12 : 6;
                    break;
            }
        });
        return total;
    }

    static findPerfectPartition(cards, forcedKouCount = -1) {
        if (!cards || cards.length === 0) return null;
        // Sort to optimize search
        const sorted = [...cards].sort((a, b) => a.typeId - b.typeId);
        const res = this._partitionRecursive(sorted, []);
        if (!res) return null;

        if (forcedKouCount !== -1) {
            let kous = 0;
            res.forEach(m => {
                if (m.type === 'KOU' || m.type === 'HALF-DRAGON' || m.type === 'HALF-SNAKE') kous++;
            });
            if (kous !== forcedKouCount) return null;
        }
        return res;
    }

    static _partitionRecursive(remaining, melds) {
        if (remaining.length === 0) return melds;

        const card = remaining[0];

        // 1. Try Dragon/Snake (6 cards: 4-of-a-kind + 2 others from suite)
        const quads = remaining.filter(c => c.typeId === card.typeId);
        if (quads.length === 4) {
            const suiteCards = remaining.filter(c => c.suiteIndex === card.suiteIndex && c.typeId !== card.typeId);
            const uniqueChars = [...new Set(suiteCards.map(c => c.characterIndex))];
            if (uniqueChars.length >= 2) {
                for (let i = 0; i < uniqueChars.length; i++) {
                    for (let j = i + 1; j < uniqueChars.length; j++) {
                        const c1 = suiteCards.find(c => c.characterIndex === uniqueChars[i]);
                        const c2 = suiteCards.find(c => c.characterIndex === uniqueChars[j]);
                        const dragonSet = [...quads, c1, c2];
                        const nextRemaining = remaining.filter(c => !dragonSet.some(d => d.id === c.id));
                        const res = this._partitionRecursive(nextRemaining, [...melds, { type: 'DRAGON', cards: dragonSet }]);
                        if (res) return res;
                    }
                }
            }
        }

        // 2. Try Half-Dragon/Half-Snake (5 cards: 4-of-a-kind + 1 other from suite)
        if (quads.length === 4) {
            const suiteCards = remaining.filter(c => c.suiteIndex === card.suiteIndex && c.typeId !== card.typeId);
            const uniqueChars = [...new Set(suiteCards.map(c => c.characterIndex))];
            for (const charIdx of uniqueChars) {
                const match = suiteCards.find(c => c.characterIndex === charIdx);
                const halfSet = [...quads, match];
                const nextRemaining = remaining.filter(c => !halfSet.some(h => h.id === c.id));
                const res = this._partitionRecursive(nextRemaining, [...melds, { type: 'HALF-DRAGON', cards: halfSet }]);
                if (res) return res;
            }
        }

        // 3. Try Quad (XIA-CE / KAI-ZAO)
        if (quads.length === 4) {
            const nextRemaining = remaining.filter(c => !quads.some(q => q.id === c.id));
            const res = this._partitionRecursive(nextRemaining, [...melds, { type: 'XIA-CE', cards: quads }]);
            if (res) return res;
        }

        // 4. Try Trip (SAO / PENG)
        if (quads.length >= 3) {
            const trips = quads.slice(0, 3);
            const nextRemaining = remaining.filter(c => !trips.some(t => t.id === c.id));
            const res = this._partitionRecursive(nextRemaining, [...melds, { type: 'SAO', cards: trips }]);
            if (res) return res;
        }

        // 5. Try Suite (CHI)
        const suiteIndices = [0, 1, 2];
        const suiteSet = [];
        let possibleCHI = true;
        for (const idx of suiteIndices) {
            const match = remaining.find(c => c.suiteIndex === card.suiteIndex && c.characterIndex === idx && !suiteSet.some(s => s.id === c.id));
            if (match) suiteSet.push(match);
            else possibleCHI = false;
        }
        if (possibleCHI) {
            const nextRemaining = remaining.filter(c => !suiteSet.some(s => s.id === c.id));
            const res = this._partitionRecursive(nextRemaining, [...melds, { type: 'CHI', cards: suiteSet }]);
            if (res) return res;
        }

        // 6. Try Pair (KOU)
        const others = remaining.filter(c => c.id !== card.id && c.suiteIndex === card.suiteIndex && c.characterIndex !== card.characterIndex);
        for (const other of others) {
            const kouSet = [card, other];
            const nextRemaining = remaining.filter(c => !kouSet.some(k => k.id === c.id));
            const res = this._partitionRecursive(nextRemaining, [...melds, { type: 'KOU', cards: kouSet }]);
            if (res) return res;
        }

        return null;
    }

    static canDeclareHarmony(hand, exposed, activeCard) {
        const allCards = [...hand];
        if (activeCard) allCards.push(activeCard);

        let expectedLength = 16;
        exposed.forEach(meld => {
            allCards.push(...meld.cards);
            if (meld.type === 'KAI-ZAO' || meld.type === 'XIA-CE') {
                expectedLength += 1;
            }
        });

        if (allCards.length !== expectedLength) return false;

        const partition = this.findPerfectPartition(allCards, 2);
        if (!partition) return false;

        const points = this.calculateTotalPoints(partition);
        return points >= SCORE_THRESHOLD;
    }

    static findMeldsInHand(hand) {
        return this.findPerfectPartition(hand) || [];
    }

    static canDiscard(hand, cardIndex) {
        const card = hand[cardIndex];

        // 1. Check if card is part of a 3-of-a-kind or 4-of-a-kind in hand
        const sameCount = hand.filter(c => c.typeId === card.typeId).length;
        if (sameCount >= 3) return false;

        // 2. Check if card is essential for a complete suite (CHI) in hand
        const suiteCards = hand.filter(c => c.suiteIndex === card.suiteIndex);
        const counts = [0, 0, 0];
        suiteCards.forEach(c => {
            counts[c.characterIndex]++;
        });

        const oldSuites = Math.min(counts[0], counts[1], counts[2]);
        if (oldSuites > 0) {
            // It's part of a suite. Is it essential?
            counts[card.characterIndex]--;
            const newSuites = Math.min(counts[0], counts[1], counts[2]);
            if (newSuites < oldSuites) return false;
        }

        return true;
    }

    static getActions(hand, card, isSelf, exposed = [], discards = []) {
        const moves = [];
        const sameInHand = hand.filter(c => c.typeId === card.typeId);
        const count = sameInHand.length;
        const suiteInHand = hand.filter(c => c.suiteIndex === card.suiteIndex && c.typeId !== card.typeId);
        const uniqueInSuite = Array.from(new Set(suiteInHand.map(c => c.characterIndex)));

        // Check if suite was already "broken" (discarded from)
        const suiteBroken = discards.some(c => c.suiteIndex === card.suiteIndex);

        // expansion upgrade: HALF-DRAGON/SNAKE into DRAGON/SNAKE
        const halfMelds = exposed.filter(m => m.type === 'HALF-DRAGON' || m.type === 'HALF-SNAKE');
        halfMelds.forEach(meld => {
            const meldSuite = meld.cards[0].suiteIndex;
            if (meldSuite === card.suiteIndex) {
                const existingChars = meld.cards.map(c => c.characterIndex);
                if (!existingChars.includes(card.characterIndex)) {
                    moves.push({
                        type: isSelf ? 'DRAGON' : 'SNAKE',
                        cards: [],
                        meldRef: meld
                    });
                }
            }
        });

        // 1. Dragon / Snake detection (4-of-a-kind + 2 others)
        if (count === 3 && uniqueInSuite.length >= 2) {
            const c1 = suiteInHand.find(c => c.characterIndex === uniqueInSuite[0]);
            const c2 = suiteInHand.find(c => c.characterIndex === uniqueInSuite[1]);
            moves.push({
                type: isSelf ? 'DRAGON' : 'SNAKE',
                cards: [...sameInHand, c1, c2]
            });
        }
        // 2. Half-Dragon / Half-Snake (4-of-a-kind + 1 other)
        else if (count === 3 && uniqueInSuite.length >= 1) {
            const c1 = suiteInHand.find(c => c.characterIndex === uniqueInSuite[0]);
            moves.push({
                type: isSelf ? 'HALF-DRAGON' : 'HALF-SNAKE',
                cards: [...sameInHand, c1]
            });
        }
        // 3. XIA-CE / KAI-ZAO (4-of-a-kind)
        else if (count === 3) {
            moves.push({
                type: isSelf ? 'KAI-ZAO' : 'XIA-CE',
                cards: sameInHand
            });
        } else {
            // Upgrade SAO to KAI-ZAO / XIA-CE
            const saoMatch = exposed.find(m => m.type === 'SAO' && m.cards[0].typeId === card.typeId);
            if (saoMatch) {
                moves.push({
                    type: isSelf ? 'KAI-ZAO' : 'XIA-CE',
                    cards: [],
                    meldRef: saoMatch
                });
            }
        }

        // 4. Trip detection (SAO / PENG)
        if (count === 2) {
            moves.push({
                type: isSelf ? 'SAO' : 'PENG',
                cards: sameInHand
            });
        }

        const kouInExposed = exposed.filter(m => m.type === 'KOU');
        const allSuiteCardsInHand = hand.filter(c => c.suiteIndex === card.suiteIndex);

        // 5a. CHI (Complete Suite)
        const needed = [0, 1, 2].filter(i => i !== card.characterIndex);
        const c1 = hand.find(c => c.suiteIndex === card.suiteIndex && c.characterIndex === needed[0]);
        const c2 = hand.find(c => c.suiteIndex === card.suiteIndex && c.characterIndex === needed[1]);

        if (c1 && c2) {
            // Determine if this CHI forms a "New" suite or just redundant
            const counts = [0, 0, 0];
            const allSuiteCards = [...hand, ...exposed.flatMap(m => m.cards)].filter(c => c.suiteIndex === card.suiteIndex);
            allSuiteCards.forEach(c => counts[c.characterIndex]++);
            const oldSuites = Math.min(counts[0], counts[1], counts[2]);
            const nextCounts = [...counts];
            nextCounts[card.characterIndex]++;
            const newSuites = Math.min(nextCounts[0], nextCounts[1], nextCounts[2]);

            if (newSuites > oldSuites) {
                // Rule check: No breaking 3-of-a-kind or 4-of-a-kind to form a CHI
                const c1HandCount = hand.filter(c => c.typeId === c1.typeId).length;
                const c2HandCount = hand.filter(c => c.typeId === c2.typeId).length;

                if (c1HandCount < 3 && c2HandCount < 3) {
                    moves.push({ type: 'CHI', cards: [c1, c2] });
                }
            }
        }

        // CHI onto KOU in exposed
        kouInExposed.forEach(meld => {
            if (meld.cards[0].suiteIndex === card.suiteIndex) {
                const indices = meld.cards.map(c => c.characterIndex);
                if (!indices.includes(card.characterIndex)) {
                    moves.push({ type: 'CHI', cards: [], meldRef: meld });
                }
            }
        });

        // 5b. KOU (2 different cards of same suite) - Optional, allowed for turn and interrupters? 
        // Based on test Case q, it should be available even if isSelf is false.
        if (kouInExposed.length < 2 && !suiteBroken && moves.length === 0) {
            const others = [0, 1, 2].filter(i => i !== card.characterIndex);
            const sCounts = [0, 0, 0];
            allSuiteCardsInHand.forEach(c => sCounts[c.characterIndex]++);

            // Try to find a partner who is redundant in hand first
            let partnerChar = others.find(i => sCounts[i] > 1);
            if (partnerChar === undefined) {
                partnerChar = others.find(i => sCounts[i] > 0);
            }

            if (partnerChar !== undefined) {
                // Redundancy check: if we already have the drawn card and only one of the partner, 
                // taking KOU is just swapping cards and potentially breaking our hand structure.
                if (sCounts[card.characterIndex] > 0 && sCounts[partnerChar] === 1) {
                    // Skip redundant KOU
                } else {
                    const partner = allSuiteCardsInHand.find(c => c.characterIndex === partnerChar);
                    moves.push({ type: 'KOU', cards: [partner] });
                }
            }
        }

        // Must-trigger rules: PENG, SAO, CHI, etc. are mandatory.
        // PASS is only allowed if no mandatory moves are present.
        const mandatoryTypes = ['SAO', 'PENG', 'CHI', 'KAI-ZAO', 'XIA-CE', 'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE'];
        const hasMandatory = moves.some(m => mandatoryTypes.includes(m.type));

        if (!hasMandatory) {
            moves.push({ type: 'PASS', cards: [] });
        }

        return moves;
    }
}

