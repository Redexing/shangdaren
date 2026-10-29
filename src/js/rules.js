
import { ALL_SUITES } from './card.js';

export const SCORE_THRESHOLD = 10;
export const HIGH_SCORE_THRESHOLD = 20;

// [RULE-HARMONY-SCORE-THRESHOLD]: these melds remove the all-veggie waiver of the
// 10 Fu gate. PENG, CHI, and KOU do not. Applies to HAND and EXPOSED alike.
const VEGGIE_WAIVER_BLOCKING_TYPES = new Set([
    'SAO',
    'XIA-CE',
    'KAI-ZAO',
    'DRAGON',
    'SNAKE',
    'HALF-DRAGON',
    'HALF-SNAKE',
    'TWO-DRAGONS-TUSSLING'
]);

// Four of a kind of these characters is worth two rewards. No other character qualifies.
export const REWARD_QUAD_CHARACTERS = ['上', '七', '可'];

const REWARD_WEIGHTS = {
    'exact-10': 1,
    'all-veggie': 1,
    'self-draw': 1,
    'score-20': 1,
    'dragon-snake': 1,
    'two-dragons-tussling': 3,
    'doubled-up': 1,
    'special-quad': 2,
    'all-meat': 1,
    'big-red': 3,
    'big-black': 4
};

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

    // A meld upgrade has to still be the meld it was when the action was chosen.
    // Exposed PENG melds are immutable ([RULE-PENG-IMMUTABLE]).
    static isLegalMeldUpgrade(meld, card, actionType, extraCards = [], mergeMeld = null) {
        if (!meld || !card || !Array.isArray(meld.cards) || meld.cards.length === 0) return false;
        if (meld.type === 'PENG') return false;
        if (meld.cards.some(c => c.id === card.id)) return false;
        const sameSuit = meld.cards.every(c => c.suiteIndex === card.suiteIndex);
        if (!sameSuit) return false;

        if (actionType === 'CHI') {
            return meld.type === 'KOU'
                && meld.cards.length === 2
                && new Set(meld.cards.map(c => c.characterIndex)).size === 2
                && meld.cards.every(c => c.characterIndex !== card.characterIndex);
        }
        if (actionType === 'XIA-CE' || actionType === 'KAI-ZAO') {
            return meld.type === 'SAO'
                && meld.cards.length === 3
                && meld.cards.every(c => c.typeId === card.typeId);
        }
        if (actionType === 'HALF-DRAGON' || actionType === 'HALF-SNAKE') {
            return meld.type === 'SAO'
                && meld.cards.length === 3
                && meld.cards.every(c => c.typeId === card.typeId)
                && Array.isArray(extraCards) && extraCards.length === 1
                && extraCards[0].suiteIndex === card.suiteIndex
                && extraCards[0].characterIndex !== card.characterIndex;
        }
        if (actionType === 'DRAGON' || actionType === 'SNAKE') {
            if (meld.type === 'HALF-DRAGON' || meld.type === 'HALF-SNAKE') {
                return meld.cards.every(c => c.characterIndex !== card.characterIndex);
            }
            if (meld.type === 'SAO' && meld.cards.length === 3 && meld.cards.every(c => c.typeId === card.typeId)) {
                const supp = mergeMeld ? mergeMeld.cards : extraCards;
                return (!mergeMeld || mergeMeld.type === 'KOU')
                    && Array.isArray(supp) && supp.length === 2
                    && supp.every(c => c.suiteIndex === card.suiteIndex && c.characterIndex !== card.characterIndex)
                    && new Set(supp.map(c => c.characterIndex)).size === 2;
            }
            if (meld.type === 'KOU' && meld.cards.length === 2) {
                return Array.isArray(extraCards) && extraCards.length === 3
                    && extraCards.every(c => c.typeId === card.typeId)
                    && meld.cards.every(c => c.characterIndex !== card.characterIndex);
            }
            return false;
        }
        if (actionType === 'TWO-DRAGONS-TUSSLING') {
            if (meld.type === 'HALF-DRAGON' || meld.type === 'HALF-SNAKE') {
                const supp = mergeMeld ? mergeMeld.cards : extraCards;
                return (!mergeMeld || mergeMeld.type === 'SAO')
                    && Array.isArray(supp) && supp.length === 3
                    && supp.every(c => c.typeId === card.typeId)
                    && !meld.cards.some(c => c.typeId === card.typeId);
            }
            return false;
        }
        return false;
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
                case 'TWO-DRAGONS-TUSSLING': {
                    const quadTypes = Array.isArray(meld.quadTypes) && meld.quadTypes.length === 2
                        ? meld.quadTypes
                        : ['KAI-ZAO', 'KAI-ZAO'];
                    quadTypes.forEach(qt => {
                        if (qt === 'KAI-ZAO') total += isMeat ? 12 : 8;
                        else total += isMeat ? 10 : 6;
                    });
                    if (isMeat) total += 2;
                    break;
                }
            }
        });
        return total;
    }

    static findPerfectPartition(cards, forcedKouCount = -1, context = null) {
        if (!cards || cards.length === 0) return null;
        // Sort so each suit is contiguous and lower characters are tried first.
        const sorted = [...cards].sort((a, b) => a.typeId - b.typeId || a.id - b.id);
        const res = this._partitionRecursive(sorted, [], context);
        if (!res) return null;

        if (forcedKouCount !== -1) {
            if (this._countKous(res) !== forcedKouCount) return null;
        }
        return res;
    }

    // A claimed card (another player drew or passed it) scores as the claimed meld.
    // A self-drawn completing card keeps the self-drawn meld name.
    static _typedMeld(selfType, cards, context) {
        const meld = { type: selfType, cards };
        if (!context || context.isSelf !== false || !context.claimedCard) return meld;
        if (!cards.some(c => c.id === context.claimedCard.id)) return meld;
        const claimed = {
            SAO: 'PENG',
            'KAI-ZAO': 'XIA-CE',
            DRAGON: 'SNAKE',
            'HALF-DRAGON': 'HALF-SNAKE'
        };
        if (claimed[selfType]) meld.type = claimed[selfType];
        return meld;
    }

    static _quadKind(cards, context) {
        if (!context || context.isSelf !== false || !context.claimedCard) return 'KAI-ZAO';
        return cards.some(c => c.id === context.claimedCard.id) ? 'XIA-CE' : 'KAI-ZAO';
    }

    static _takeMeld(remaining, melds, set, meld, context) {
        const ids = new Set(set.map(c => c.id));
        const next = remaining.filter(c => !ids.has(c.id));
        return this._partitionRecursive(next, [...melds, meld], context);
    }

    // [RULE-SUIT-MELD-PRIORITY]: inside one suit, form 4-of-a-kind patterns, then
    // 3-of-a-kind, then CHI, then KOU. Never split a 3- or 4-of-a-kind into CHI/KOU.
    static _partitionRecursive(remaining, melds, context = null) {
        if (remaining.length === 0) return melds;

        const suitIndex = remaining[0].suiteIndex;
        const byChar = [[], [], []];
        remaining.forEach(c => {
            if (c.suiteIndex === suitIndex) byChar[c.characterIndex].push(c);
        });
        const counts = byChar.map(group => group.length);
        const quadChars = [0, 1, 2].filter(i => counts[i] === 4);

        const take = (set, meld) => this._takeMeld(remaining, melds, set, meld, context);

        if (quadChars.length >= 2) {
            // Two quads plus one other card of the suit are TWO-DRAGONS-TUSSLING.
            // If that shape cannot finish the hand, keep the quads whole instead.
            if (quadChars.length === 2) {
                const singleChar = [0, 1, 2].find(i => counts[i] > 0 && counts[i] < 4);
                if (singleChar !== undefined) {
                    const quadA = byChar[quadChars[0]];
                    const quadB = byChar[quadChars[1]];
                    const set = [...quadA, ...quadB, byChar[singleChar][0]];
                    const tussling = take(set, {
                        type: 'TWO-DRAGONS-TUSSLING',
                        cards: set,
                        quadTypes: [this._quadKind(quadA, context), this._quadKind(quadB, context)]
                    });
                    if (tussling) return tussling;
                }
            }
            const plainQuad = take(byChar[quadChars[0]], this._typedMeld('KAI-ZAO', byChar[quadChars[0]], context));
            return plainQuad || null;
        }

        if (quadChars.length === 1) {
            const quad = byChar[quadChars[0]];
            const others = [0, 1, 2].filter(i => i !== quadChars[0] && counts[i] > 0);
            // Longer 4-of-a-kind shapes first. A shorter one is used only when the
            // longer shape cannot finish a perfect partition of the whole hand.
            if (others.length >= 2) {
                const dragonSet = [quad, byChar[others[0]][0], byChar[others[1]][0]].flat();
                const dragon = take(dragonSet, this._typedMeld('DRAGON', dragonSet, context));
                if (dragon) return dragon;
            }
            for (const other of others) {
                const halfSet = [...quad, byChar[other][0]];
                const half = take(halfSet, this._typedMeld('HALF-DRAGON', halfSet, context));
                if (half) return half;
            }
            const plain = take(quad, this._typedMeld('KAI-ZAO', quad, context));
            if (plain) return plain;
            return null;
        }

        const tripChar = counts.findIndex(count => count >= 3);
        if (tripChar !== -1) {
            const trip = byChar[tripChar].slice(0, 3);
            const res = take(trip, this._typedMeld('SAO', trip, context));
            return res || null;
        }

        if (counts[0] >= 1 && counts[1] >= 1 && counts[2] >= 1) {
            const suiteSet = [byChar[0][0], byChar[1][0], byChar[2][0]];
            const chi = take(suiteSet, { type: 'CHI', cards: suiteSet });
            if (chi) return chi;
        }

        const anchor = byChar.find(group => group.length > 0)[0];
        for (let charIndex = 0; charIndex < 3; charIndex++) {
            if (byChar[charIndex].length === 0 || byChar[charIndex][0].id === anchor.id) continue;
            const kouSet = [anchor, byChar[charIndex][0]];
            const kou = take(kouSet, { type: 'KOU', cards: kouSet });
            if (kou) return kou;
        }

        return null;
    }

    static _countKous(melds) {
        let kous = 0;
        (melds || []).forEach(m => {
            if (m.type === 'KOU' || m.type === 'HALF-DRAGON' || m.type === 'HALF-SNAKE') kous++;
        });
        return kous;
    }

    // KOU, HALF-DRAGON, and HALF-SNAKE each occupy one exposed KOU slot.
    static exposedKouCount(exposed = []) {
        return this._countKous(exposed);
    }

    // A new KOU, HALF-DRAGON, or HALF-SNAKE would be a third exposed KOU.
    static wouldExceedExposedKouLimit(exposed, actionType) {
        if (actionType !== 'KOU' && actionType !== 'HALF-DRAGON' && actionType !== 'HALF-SNAKE') return false;
        return this.exposedKouCount(exposed) >= 2;
    }

    static _partitionWithExposed(exposedMelds, handPool, context = null) {
        const exposedKous = this._countKous(exposedMelds);
        if (exposedKous > 2) return null;
        if (handPool.length === 0) {
            return exposedKous === 2 ? [...exposedMelds] : null;
        }
        const handPartition = this.findPerfectPartition(handPool, 2 - exposedKous, context);
        if (!handPartition) return null;
        return [...exposedMelds, ...handPartition];
    }

    /**
     * Structural harmony shape: card count, perfect partition, exactly 2 KOU.
     * Exposed melds can grow or merge with activeCard, but can never be split ([RULE-MELD-NO-SPLIT]).
     * Returns null when the set cannot be a winning hand.
     * Score and reward gates are applied by the callers.
     */
    static assessHarmony(hand, exposed = [], activeCard = null, options = {}) {
        const handList = [...(hand || [])];
        const exposedList = (exposed || []).map(m => ({ ...m, cards: [...m.cards] }));
        const allCards = [...handList];
        if (activeCard) allCards.push(activeCard);

        let expectedLength = 16;
        exposedList.forEach(meld => {
            allCards.push(...meld.cards);
            if (meld.type === 'KAI-ZAO' || meld.type === 'XIA-CE') {
                expectedLength += 1;
            }
        });

        if (allCards.length !== expectedLength) return null;

        let partition = null;
        const isSelf = options.isSelf !== undefined
            ? Boolean(options.isSelf)
            : (options.isSelfDraw !== undefined ? Boolean(options.isSelfDraw) : true);
        // Claimed vs self-drawn naming applies only to the meld that contains this card.
        const partitionContext = activeCard ? { claimedCard: activeCard, isSelf } : null;

        // 1. Priority: try legal exposed meld upgrades/merges when activeCard is present ([RULE-EXPOSED-PRIORITY])
        if (activeCard && exposedList.length > 0) {
            const sameInHand = handList.filter(c => c.typeId === activeCard.typeId);
            const suiteInHand = handList.filter(c => c.suiteIndex === activeCard.suiteIndex && c.typeId !== activeCard.typeId);
            const availSuite = suiteInHand.filter(c => handList.filter(hc => hc.typeId === c.typeId).length < 3);
            const availUnique = Array.from(new Set(availSuite.map(c => c.characterIndex)));

            for (let i = 0; i < exposedList.length && !partition; i++) {
                const m = exposedList[i];
                // KOU -> CHI
                if (this.isLegalMeldUpgrade(m, activeCard, 'CHI')) {
                    const nextExp = exposedList.map((em, idx) => idx === i ? { ...em, type: 'CHI', cards: [...em.cards, activeCard] } : em);
                    partition = this._partitionWithExposed(nextExp, handList, partitionContext);
                }
                // HALF-DRAGON/HALF-SNAKE -> TWO-DRAGONS-TUSSLING (with exposed SAO or 3 in hand)
                if (!partition && (m.type === 'HALF-DRAGON' || m.type === 'HALF-SNAKE')) {
                    const saoIdx = exposedList.findIndex((em, idx) => idx !== i && em.type === 'SAO' && em.cards[0].typeId === activeCard.typeId);
                    const q1 = m.type === 'HALF-DRAGON' ? 'KAI-ZAO' : 'XIA-CE';
                    const q2 = isSelf ? 'KAI-ZAO' : 'XIA-CE';
                    if (saoIdx !== -1 && this.isLegalMeldUpgrade(m, activeCard, 'TWO-DRAGONS-TUSSLING', [], exposedList[saoIdx])) {
                        const nextExp = exposedList
                            .filter((_, idx) => idx !== saoIdx)
                            .map(em => em === m ? {
                                ...em,
                                type: 'TWO-DRAGONS-TUSSLING',
                                cards: [...em.cards, ...exposedList[saoIdx].cards, activeCard],
                                quadTypes: [q1, q2]
                            } : em);
                        partition = this._partitionWithExposed(nextExp, handList, partitionContext);
                    } else if (sameInHand.length === 3 && this.isLegalMeldUpgrade(m, activeCard, 'TWO-DRAGONS-TUSSLING', sameInHand)) {
                        const nextExp = exposedList.map((em, idx) => idx === i ? {
                            ...em,
                            type: 'TWO-DRAGONS-TUSSLING',
                            cards: [...em.cards, ...sameInHand, activeCard],
                            quadTypes: [q1, q2]
                        } : em);
                        const remHand = handList.filter(c => !sameInHand.some(sc => sc.id === c.id));
                        partition = this._partitionWithExposed(nextExp, remHand, partitionContext);
                    } else if (this.isLegalMeldUpgrade(m, activeCard, isSelf ? 'DRAGON' : 'SNAKE')) {
                        const nextExp = exposedList.map((em, idx) => idx === i ? {
                            ...em,
                            type: isSelf ? 'DRAGON' : 'SNAKE',
                            cards: [...em.cards, activeCard]
                        } : em);
                        partition = this._partitionWithExposed(nextExp, handList, partitionContext);
                    }
                }
                // SAO -> DRAGON/SNAKE or HALF-DRAGON/HALF-SNAKE
                if (!partition && m.type === 'SAO' && m.cards[0].typeId === activeCard.typeId) {
                    const kouIdx = exposedList.findIndex((em, idx) => idx !== i && em.type === 'KOU' && em.cards[0].suiteIndex === activeCard.suiteIndex);
                    if (kouIdx !== -1 && this.isLegalMeldUpgrade(m, activeCard, isSelf ? 'DRAGON' : 'SNAKE', [], exposedList[kouIdx])) {
                        const nextExp = exposedList
                            .filter((_, idx) => idx !== kouIdx)
                            .map(em => em === m ? {
                                ...em,
                                type: isSelf ? 'DRAGON' : 'SNAKE',
                                cards: [...em.cards, ...exposedList[kouIdx].cards, activeCard]
                            } : em);
                        partition = this._partitionWithExposed(nextExp, handList, partitionContext);
                    } else if (availUnique.length >= 2) {
                        const c1 = availSuite.find(c => c.characterIndex === availUnique[0]);
                        const c2 = availSuite.find(c => c.characterIndex === availUnique[1]);
                        const nextExp = exposedList.map((em, idx) => idx === i ? {
                            ...em,
                            type: isSelf ? 'DRAGON' : 'SNAKE',
                            cards: [...em.cards, c1, c2, activeCard]
                        } : em);
                        const remHand = handList.filter(c => c.id !== c1.id && c.id !== c2.id);
                        partition = this._partitionWithExposed(nextExp, remHand, partitionContext);
                    } else if (availUnique.length === 1) {
                        const c1 = availSuite.find(c => c.characterIndex === availUnique[0]);
                        const nextExp = exposedList.map((em, idx) => idx === i ? {
                            ...em,
                            type: isSelf ? 'HALF-DRAGON' : 'HALF-SNAKE',
                            cards: [...em.cards, c1, activeCard]
                        } : em);
                        const remHand = handList.filter(c => c.id !== c1.id);
                        partition = this._partitionWithExposed(nextExp, remHand, partitionContext);
                    }
                }
                // KOU + 3-of-a-kind in hand + 4th activeCard -> DRAGON/SNAKE
                if (!partition && m.type === 'KOU' && sameInHand.length === 3 && this.isLegalMeldUpgrade(m, activeCard, isSelf ? 'DRAGON' : 'SNAKE', sameInHand)) {
                    const nextExp = exposedList.map((em, idx) => idx === i ? {
                        ...em,
                        type: isSelf ? 'DRAGON' : 'SNAKE',
                        cards: [...em.cards, ...sameInHand, activeCard]
                    } : em);
                    const remHand = handList.filter(c => !sameInHand.some(sc => sc.id === c.id));
                    partition = this._partitionWithExposed(nextExp, remHand, partitionContext);
                }
            }
        }

        // 2. Otherwise keep exposed melds intact and partition hand (+ activeCard)
        if (!partition) {
            const handPool = activeCard ? [...handList, activeCard] : handList;
            partition = this._partitionWithExposed(exposedList, handPool, partitionContext);

            // If activeCard was already placed into hand, allow growing an exposed KOU into CHI
            if (!partition && !activeCard && exposedList.length > 0) {
                for (let i = 0; i < exposedList.length && !partition; i++) {
                    const m = exposedList[i];
                    if (m.type === 'KOU') {
                        const match = handPool.find(c => this.isLegalMeldUpgrade(m, c, 'CHI'));
                        if (match) {
                            const nextExp = exposedList.map((em, idx) => idx === i ? { ...em, type: 'CHI', cards: [...em.cards, match] } : em);
                            const remHand = handPool.filter(c => c.id !== match.id);
                            partition = this._partitionWithExposed(nextExp, remHand, partitionContext);
                        }
                    }
                }
            }
        }

        if (!partition) return null;

        const points = this.calculateTotalPoints(partition);
        const meetsScore = points >= SCORE_THRESHOLD || this.allVeggieWaivesScore(allCards, partition);
        return { allCards, partition, points, meetsScore };
    }

    static rewardReasons(allCards, partition, points, isSelfDraw) {
        const reasons = [];
        if (points === SCORE_THRESHOLD) reasons.push('exact-10');
        if (this.isAllVeggie(allCards)) reasons.push('all-veggie');
        if (isSelfDraw) reasons.push('self-draw');
        if (points >= HIGH_SCORE_THRESHOLD) reasons.push('score-20');
        if (partition.some(m => m.type === 'DRAGON' || m.type === 'SNAKE')) reasons.push('dragon-snake');
        if (partition.some(m => m.type === 'TWO-DRAGONS-TUSSLING')) reasons.push('two-dragons-tussling');
        const doubledUp = this.doubledUpPairs(partition);
        for (let i = 0; i < doubledUp; i++) reasons.push('doubled-up');
        if (this.hasRewardQuad(allCards)) reasons.push('special-quad');
        if (allCards.length > 0 && allCards.every(c => this.isMeat(c.suiteIndex))) reasons.push('all-meat');
        if (allCards.length > 0 && allCards.every(c => c.isRed)) reasons.push('big-red');
        if (allCards.length > 0 && allCards.every(c => !c.isRed)) reasons.push('big-black');
        return reasons;
    }

    static rewardTotal(reasons) {
        return reasons.reduce((sum, reason) => sum + (REWARD_WEIGHTS[reason] || 0), 0);
    }

    /**
     * [RULE-REWARD-DOUBLED-UP]: one reward per pair of identical CHI.
     * CHI of the same suit are identical. HAND and EXPOSED both count.
     */
    static doubledUpPairs(partition) {
        const counts = new Map();
        (partition || []).forEach(meld => {
            if (!meld || meld.type !== 'CHI' || !this.isCompleteSuite(meld.cards)) return;
            const suit = meld.cards[0].suiteIndex;
            counts.set(suit, (counts.get(suit) || 0) + 1);
        });
        let pairs = 0;
        counts.forEach(count => { pairs += Math.floor(count / 2); });
        return pairs;
    }

    static hasRewardQuad(cards) {
        const counts = Object.create(null);
        REWARD_QUAD_CHARACTERS.forEach(ch => { counts[ch] = 0; });
        cards.forEach(c => {
            if (Object.prototype.hasOwnProperty.call(counts, c.character)) counts[c.character]++;
        });
        return REWARD_QUAD_CHARACTERS.some(ch => counts[ch] >= 4);
    }

    /**
     * Reward (大) for a hand that already meets every other Harmony condition.
     * total is 0 when the set is not otherwise a winning hand.
     * isSelfDraw is true only when this player drew the completing card from the deck.
     */
    static calculateRewards(hand, exposed, activeCard, options = {}) {
        const assessed = this.assessHarmony(hand, exposed, activeCard, options);
        if (!assessed || !assessed.meetsScore) return { total: 0, reasons: [] };

        const reasons = this.rewardReasons(
            assessed.allCards,
            assessed.partition,
            assessed.points,
            !!options.isSelfDraw
        );
        return { total: this.rewardTotal(reasons), reasons, points: assessed.points };
    }

    static canDeclareHarmony(hand, exposed, activeCard, options = {}) {
        const reward = this.calculateRewards(hand, exposed, activeCard, options);
        return reward.total >= 1;
    }

    /**
     * [RULE-NAKED-QUAD-REVEAL]: Finds a 4-of-a-kind in hand where the player holds
     * no other cards from the same suit in hand.
     */
    static findNakedQuadInHand(hand) {
        if (!Array.isArray(hand) || hand.length < 4) return null;
        const byType = new Map();
        hand.forEach(c => {
            if (!byType.has(c.typeId)) byType.set(c.typeId, []);
            byType.get(c.typeId).push(c);
        });
        for (const [, group] of byType.entries()) {
            if (group.length === 4) {
                const suiteIdx = group[0].suiteIndex;
                const sameSuitCount = hand.filter(c => c.suiteIndex === suiteIdx).length;
                if (sameSuitCount === 4) {
                    return group;
                }
            }
        }
        return null;
    }

    static firstLegalDiscardIndex(hand) {
        if (!hand) return -1;
        for (let i = 0; i < hand.length; i++) {
            if (this.canDiscard(hand, i)) return i;
        }
        return -1;
    }

    static isAllVeggie(cards) {
        return Array.isArray(cards) && cards.length > 0 && cards.every(c => !this.isMeat(c.suiteIndex));
    }

    /**
     * [RULE-HARMONY-SCORE-THRESHOLD]: all-veggie hands skip the 10 Fu gate unless
     * the winning partition contains a SAO or a meld with a 4-of-a-kind.
     */
    static allVeggieWaivesScore(allCards, partition) {
        if (!this.isAllVeggie(allCards)) return false;
        return !(partition || []).some(m => VEGGIE_WAIVER_BLOCKING_TYPES.has(m.type));
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

    /**
     * No-do-over for KOU. A suit stays closed for the rest of the game when
     * this player has discarded any card of that suit, or previously declined
     * a card when KOU was a legal option. A pass that could not form KOU does
     * not close the suit. Harmony can still use a closed suit.
     */
    static isKouClosed(card, discards = [], declinedKouCards = []) {
        if (!card) return false;
        const sameSuit = (c) => c && c.suiteIndex === card.suiteIndex;
        return (discards || []).some(sameSuit)
            || (declinedKouCards || []).some(sameSuit);
    }

    static getActions(hand, card, isSelf, exposed = [], discards = [], options = {}) {
        const moves = [];
        const sameInHand = hand.filter(c => c.typeId === card.typeId);
        const count = sameInHand.length;
        const suiteInHand = hand.filter(c => c.suiteIndex === card.suiteIndex && c.typeId !== card.typeId);
        // Do not break a 3-of-a-kind or 4-of-a-kind in hand to supply extra cards
        const availSuiteInHand = suiteInHand.filter(c => hand.filter(hc => hc.typeId === c.typeId).length < 3);
        const uniqueInSuite = Array.from(new Set(availSuiteInHand.map(c => c.characterIndex)));

        const declinedKouCards = options.declinedKouCards || [];
        const suiteBroken = this.isKouClosed(card, discards, declinedKouCards);

        const saoMatch = exposed.find(m => m.type === 'SAO' && m.cards[0].typeId === card.typeId);
        const halfMeldInSuite = exposed.find(
            m => (m.type === 'HALF-DRAGON' || m.type === 'HALF-SNAKE') && m.cards[0].suiteIndex === card.suiteIndex
        );
        const kouInExposed = exposed.filter(m => m.type === 'KOU');
        const sameSuitExposedKou = kouInExposed.find(
            m => m.cards[0].suiteIndex === card.suiteIndex
                && m.cards.length === 2
                && m.cards.every(c => c.characterIndex !== card.characterIndex)
        );

        // [RULE-MELD-UPGRADE-SAO] & [RULE-MELD-UPGRADE-TWO-DRAGONS] & [RULE-EXPOSED-PRIORITY]
        if (count === 3 || saoMatch) {
            const firstQuadFromHalf = halfMeldInSuite
                ? (halfMeldInSuite.type === 'HALF-DRAGON' ? 'KAI-ZAO' : 'XIA-CE')
                : null;
            const secondQuadType = isSelf ? 'KAI-ZAO' : 'XIA-CE';

            // 1a. Exposed HALF-DRAGON/HALF-SNAKE + 2nd quad of same suit -> TWO-DRAGONS-TUSSLING
            if (halfMeldInSuite && !halfMeldInSuite.cards.some(c => c.typeId === card.typeId)) {
                if (saoMatch) {
                    moves.push({
                        type: 'TWO-DRAGONS-TUSSLING',
                        cards: [],
                        meldRef: halfMeldInSuite,
                        mergeMeldRef: saoMatch,
                        quadTypes: [firstQuadFromHalf, secondQuadType]
                    });
                } else {
                    moves.push({
                        type: 'TWO-DRAGONS-TUSSLING',
                        cards: sameInHand,
                        meldRef: halfMeldInSuite,
                        quadTypes: [firstQuadFromHalf, secondQuadType]
                    });
                }
            }
            // 1b. Merge with exposed KOU of same suit -> DRAGON / SNAKE ([RULE-EXPOSED-PRIORITY])
            else if (sameSuitExposedKou) {
                if (saoMatch) {
                    moves.push({
                        type: isSelf ? 'DRAGON' : 'SNAKE',
                        cards: [],
                        meldRef: saoMatch,
                        mergeMeldRef: sameSuitExposedKou
                    });
                } else {
                    moves.push({
                        type: isSelf ? 'DRAGON' : 'SNAKE',
                        cards: sameInHand,
                        meldRef: sameSuitExposedKou
                    });
                }
            }
            // 1c. Other 2 cards of same suit in HAND -> DRAGON / SNAKE
            else if (uniqueInSuite.length >= 2) {
                const c1 = availSuiteInHand.find(c => c.characterIndex === uniqueInSuite[0]);
                const c2 = availSuiteInHand.find(c => c.characterIndex === uniqueInSuite[1]);
                if (saoMatch) {
                    moves.push({
                        type: isSelf ? 'DRAGON' : 'SNAKE',
                        cards: [c1, c2],
                        meldRef: saoMatch
                    });
                } else {
                    moves.push({
                        type: isSelf ? 'DRAGON' : 'SNAKE',
                        cards: [...sameInHand, c1, c2]
                    });
                }
            }
            // 1d. 1 other card of same suit in HAND -> HALF-DRAGON / HALF-SNAKE
            else if (uniqueInSuite.length >= 1) {
                const c1 = availSuiteInHand.find(c => c.characterIndex === uniqueInSuite[0]);
                if (saoMatch) {
                    moves.push({
                        type: isSelf ? 'HALF-DRAGON' : 'HALF-SNAKE',
                        cards: [c1],
                        meldRef: saoMatch
                    });
                } else {
                    moves.push({
                        type: isSelf ? 'HALF-DRAGON' : 'HALF-SNAKE',
                        cards: [...sameInHand, c1]
                    });
                }
            }
            // 1e. Pure 4-of-a-kind -> KAI-ZAO / XIA-CE
            else if (saoMatch) {
                moves.push({
                    type: isSelf ? 'KAI-ZAO' : 'XIA-CE',
                    cards: [],
                    meldRef: saoMatch
                });
            } else {
                moves.push({
                    type: isSelf ? 'KAI-ZAO' : 'XIA-CE',
                    cards: sameInHand
                });
            }
        } else if (halfMeldInSuite) {
            // Expansion upgrade: HALF-DRAGON/SNAKE into DRAGON/SNAKE
            const existingChars = halfMeldInSuite.cards.map(c => c.characterIndex);
            if (!existingChars.includes(card.characterIndex)) {
                moves.push({
                    type: isSelf ? 'DRAGON' : 'SNAKE',
                    cards: [],
                    meldRef: halfMeldInSuite
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

        const allSuiteCardsInHand = hand.filter(c => c.suiteIndex === card.suiteIndex);

        // 5a. CHI ([RULE-EXPOSED-PRIORITY]: upgrade exposed KOU to CHI first before forming CHI from hand)
        // When the 4th identical card completes a quad/dragon/snake (count === 3 || saoMatch), it cannot downgrade to CHI.
        if (count < 3 && !saoMatch) {
            let upgradedExposedKou = false;
            kouInExposed.forEach(meld => {
                if (this.isLegalMeldUpgrade(meld, card, 'CHI')) {
                    moves.push({ type: 'CHI', cards: [], meldRef: meld });
                    upgradedExposedKou = true;
                }
            });

            const needed = [0, 1, 2].filter(i => i !== card.characterIndex);
            const c1 = hand.find(c => c.suiteIndex === card.suiteIndex && c.characterIndex === needed[0]);
            const c2 = hand.find(c => c.suiteIndex === card.suiteIndex && c.characterIndex === needed[1]);

            if (!upgradedExposedKou && c1 && c2) {
                // A new CHI is judged from HAND only. Exposed melds are already
                // formed ([RULE-MELD-NO-SPLIT], [RULE-PENG-IMMUTABLE]). Counting
                // them made a PENG of 人 look like a finished 上大人, so drawing
                // 人 with 上 and 大 in hand offered no CHI.
                const counts = [0, 0, 0];
                allSuiteCardsInHand.forEach(c => counts[c.characterIndex]++);
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
        }

        // 5b. KOU (2 different cards of same suite) - Optional.
        // HALF-DRAGON and HALF-SNAKE count toward the same limit of 2.
        if (this.exposedKouCount(exposed) < 2 && !suiteBroken && moves.length === 0) {
            const others = [0, 1, 2].filter(i => i !== card.characterIndex);
            const sCounts = [0, 0, 0];
            allSuiteCardsInHand.forEach(c => sCounts[c.characterIndex]++);

            // Prefer a spare copy. A 3- or 4-of-a-kind is never a partner, and neither
            // is a card that is essential to an in-hand CHI ([RULE-KOU-NO-BREAK-HAND]).
            const partnerChars = [
                ...others.filter(i => sCounts[i] === 2),
                ...others.filter(i => sCounts[i] === 1)
            ];
            for (const partnerChar of partnerChars) {
                // Holding this character already, plus only one of the partner, just swaps
                // cards and breaks a complete CHI. Try the next spare instead.
                if (sCounts[card.characterIndex] > 0 && sCounts[partnerChar] === 1) continue;
                const partner = allSuiteCardsInHand.find(c => c.characterIndex === partnerChar);
                const partnerIndex = hand.indexOf(partner);
                if (partnerIndex === -1 || !this.canDiscard(hand, partnerIndex)) continue;
                moves.push({ type: 'KOU', cards: [partner] });
                break;
            }
        }

        if (this.canDeclareHarmony(hand, exposed, card, { ...options, isSelf })) {
            if (!moves.some(m => m.type === 'HARMONY')) {
                moves.push({ type: 'HARMONY', cards: [] });
            }
        }

        // Must-trigger rules: PENG, SAO, CHI, etc. are mandatory.
        // HARMONY must-vs-choice depends on who drew the card (handled in game.js).
        // PASS is only allowed if no mandatory moves are present.
        const mandatoryTypes = [
            'SAO', 'PENG', 'CHI', 'KAI-ZAO', 'XIA-CE',
            'DRAGON', 'SNAKE', 'HALF-DRAGON', 'HALF-SNAKE', 'TWO-DRAGONS-TUSSLING'
        ];
        const hasMandatory = moves.some(m => mandatoryTypes.includes(m.type));

        if (!hasMandatory) {
            moves.push({ type: 'PASS', cards: [] });
        }

        return moves;
    }
}

