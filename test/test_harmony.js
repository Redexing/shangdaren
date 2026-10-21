import { Card } from '../src/js/card.js';
import { Rules } from '../src/js/rules.js';

const VEG_SUITE_4 = 6; // 佳, 作, 仁
const VEG_SUITE_5 = 7; // 可, 知, 礼

let fixtureId = 500;
const nextFixtureId = () => fixtureId++;

function card(suiteIndex, characterIndex) {
    return new Card(nextFixtureId(), suiteIndex, characterIndex);
}

function trip(suiteIndex, characterIndex) {
    return [card(suiteIndex, characterIndex), card(suiteIndex, characterIndex), card(suiteIndex, characterIndex)];
}

/**
 * Reconstructs the GitHub issue #1 screenshot:
 * exposed CHI 可知礼, SAO 小小小, KOU 佳仁, SAO 生生生;
 * hand 十土八九; active 作. All veggie, 8 fu, exactly 2 KOU after taking 作.
 */
export function buildScreenshotHarmonyState() {
    fixtureId = 500;
    return {
        hand: [
            card(3, 1), // 十
            card(3, 2), // 土
            card(5, 0), // 八
            card(5, 1)  // 九
        ],
        exposed: [
            { type: 'CHI', cards: [card(VEG_SUITE_5, 0), card(VEG_SUITE_5, 1), card(VEG_SUITE_5, 2)] },
            { type: 'SAO', cards: trip(4, 1) },
            { type: 'KOU', cards: [card(VEG_SUITE_4, 0), card(VEG_SUITE_4, 2)] }, // 佳, 仁
            { type: 'SAO', cards: trip(4, 2) }
        ],
        activeCard: card(VEG_SUITE_4, 1) // 作
    };
}

export function runHarmonyTests() {
    console.log("Running Rules.canDeclareHarmony tests...");

    const MEAT_SUITE_1 = 0;
    const MEAT_SUITE_2 = 1;
    const MEAT_SUITE_3 = 2;
    const VEG_SUITE_1 = 3;
    const VEG_SUITE_2 = 4;
    const VEG_SUITE_3 = 5;

    let idTracker = 100;
    const getNextId = () => idTracker++;

    const makeChi = (suiteIndex) => [
        new Card(getNextId(), suiteIndex, 0),
        new Card(getNextId(), suiteIndex, 1),
        new Card(getNextId(), suiteIndex, 2)
    ];

    const makeKou = (suiteIndex, char1, char2) => [
        new Card(getNextId(), suiteIndex, char1),
        new Card(getNextId(), suiteIndex, char2)
    ];

    const makeTrip = (suiteIndex, charIndex) => [
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex)
    ];

    const makeQuad = (suiteIndex, charIndex) => [
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex)
    ];

    const testCases = [
        {
            name: "Valid Harmony (Exactly 10 points: 2 Meat KOU, 2 Meat CHI, 2 Veggie CHI)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1), // 2 pts
                ...makeKou(MEAT_SUITE_2, 0, 1), // 2 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(MEAT_SUITE_1),       // 3 pts
                ...makeChi(VEG_SUITE_1),        // 0 pts
                ...makeChi(VEG_SUITE_2)         // 0 pts
            ],
            exposed: [],
            activeCard: null,
            expected: true
        },
        {
            name: "Invalid Harmony (9 points: 2 Veggie KOU, 3 Meat CHI, 1 Veggie CHI)",
            hand: [
                ...makeKou(VEG_SUITE_1, 0, 1), // 0 pts
                ...makeKou(VEG_SUITE_2, 0, 1), // 0 pts
                ...makeChi(MEAT_SUITE_1),      // 3 pts
                ...makeChi(MEAT_SUITE_2),      // 3 pts
                ...makeChi(MEAT_SUITE_3),      // 3 pts
                ...makeChi(VEG_SUITE_3)        // 0 pts
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "Invalid Harmony (Incorrect card count: 13 cards instead of 16)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1),
                ...makeKou(MEAT_SUITE_2, 0, 1),
                ...makeChi(MEAT_SUITE_1),
                ...makeChi(MEAT_SUITE_2),
                ...makeChi(MEAT_SUITE_3)
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "11-fu mixed hand cannot Harmony without a reward",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1), // 2 pts
                ...makeKou(MEAT_SUITE_2, 0, 1), // 2 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(VEG_SUITE_3),        // 0 pts
                new Card(getNextId(), VEG_SUITE_1, 0), // part of CHI (0 pts)
                new Card(getNextId(), VEG_SUITE_1, 1)  // part of CHI (0 pts)
            ],
            exposed: [
                {
                    type: 'SAO', // Veggie SAO -> 4 pts
                    cards: makeTrip(VEG_SUITE_2, 0)
                }
            ],
            activeCard: new Card(getNextId(), VEG_SUITE_1, 2), // completes CHI
            expected: false
        },
        {
            name: "CHI split by an exposed extra card cannot Harmony without a reward",
            hand: [
                ...makeChi(MEAT_SUITE_1), // 3 pts
                ...makeTrip(MEAT_SUITE_2, 0), // 6 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(VEG_SUITE_3),        // 0 pts
            ],
            exposed: [
                {
                    type: 'CHI',
                    cards: makeChi(VEG_SUITE_2)
                }
            ],
            activeCard: new Card(getNextId(), VEG_SUITE_2, 1), // turn exposed CHI into KOU
            expected: false
        },
        {
            name: "CHI split in hand cannot Harmony without a reward",
            hand: [
                ...makeChi(MEAT_SUITE_1), // 3 pts
                ...makeTrip(MEAT_SUITE_2, 0), // 6 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(VEG_SUITE_3),        // 0 pts
            ],
            exposed: [
                {
                    type: 'CHI',
                    cards: makeChi(VEG_SUITE_2)
                }
            ],
            activeCard: new Card(getNextId(), MEAT_SUITE_1, 1), // turn hand CHI into KOU
            expected: false
        },
        {
            name: "17-card XIA-CE hand cannot Harmony without a reward",
            hand: [
                ...makeChi(MEAT_SUITE_1), // 3 pts
                ...makeTrip(MEAT_SUITE_2, 0), // 6 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeKou(VEG_SUITE_3, 0, 1),        // 0 pts
                new Card(getNextId(), VEG_SUITE_1, 0)
            ],
            exposed: [
                {
                    type: 'XIA-CE',
                    cards: makeQuad(VEG_SUITE_2, 0)
                }
            ],
            activeCard: new Card(getNextId(), VEG_SUITE_1, 1), // completes a veggie KOU
            expected: false
        },
        {
            name: "Invalid Harmony (Hand cannot be perfectly partitioned with 2 KOU)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1),
                ...makeKou(MEAT_SUITE_2, 0, 1),
                ...makeKou(MEAT_SUITE_3, 0, 1), // 3 KOUs instead of 2!
                ...makeChi(MEAT_SUITE_1),
                ...makeChi(VEG_SUITE_1),
                new Card(getNextId(), VEG_SUITE_2, 0)
                // This makes 16 cards total, but cannot form exactly 2 KOUs along with valid melds
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "Valid Harmony using HALF-DRAGON as one of the KOUs",
            hand: [
                // HALF-DRAGON: 4 of a kind + 1 other. Total 5 cards. (14 pts if meat)
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 1),

                ...makeKou(VEG_SUITE_1, 0, 1), // 1 KOU (2 cards) -> 0 pts

                ...makeChi(VEG_SUITE_2), // 3 cards -> 0 pts
                ...makeChi(VEG_SUITE_3), // 3 cards -> 0 pts
                ...makeChi(MEAT_SUITE_2) // 3 cards -> 3 pts
            ],
            exposed: [],
            activeCard: null,
            expected: true // Total pts: 14 + 0 + 0 + 0 + 3 = 17 pts >= 10
        },
        {
            name: "Valid all-veggie Harmony waives the 10-fu threshold (0 points)",
            hand: [
                ...makeKou(VEG_SUITE_1, 0, 1), // 0 pts
                ...makeKou(VEG_SUITE_2, 0, 1), // 0 pts
                ...makeChi(VEG_SUITE_1),       // 0 pts
                ...makeChi(VEG_SUITE_2),       // 0 pts
                ...makeChi(VEG_SUITE_3),       // 0 pts
                ...makeChi(6)                  // suite 佳作仁, 0 pts
            ],
            exposed: [],
            activeCard: null,
            expected: true
        },
        {
            name: "Issue #1/#2 screenshot: all-veggie 8-fu hand can Harmony on 作",
            ...buildScreenshotHarmonyState(),
            expected: true
        },
        {
            name: "All-veggie still requires a perfect partition with exactly 2 KOU",
            hand: [
                ...makeKou(VEG_SUITE_1, 0, 1),
                ...makeKou(VEG_SUITE_2, 0, 1),
                ...makeKou(VEG_SUITE_3, 0, 1), // 3 KOUs
                ...makeChi(VEG_SUITE_1),
                ...makeChi(VEG_SUITE_2),
                new Card(getNextId(), 6, 0)
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "Meat cards still require 10 fu even with a valid 2-KOU partition",
            hand: [
                ...makeKou(VEG_SUITE_1, 0, 1), // 0 pts
                ...makeKou(VEG_SUITE_2, 0, 1), // 0 pts
                ...makeChi(MEAT_SUITE_1),      // 3 pts
                ...makeChi(MEAT_SUITE_2),      // 3 pts
                ...makeChi(MEAT_SUITE_3),      // 3 pts
                ...makeChi(VEG_SUITE_3)        // 0 pts  => 9 total
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "[RULE-MELD-NO-SPLIT] Exposed CHI cannot be split even in an all-veggie hand with rewards",
            hand: [
                ...makeChi(VEG_SUITE_1),
                ...makeChi(VEG_SUITE_3),
                ...makeChi(6),
                ...makeChi(7)
            ],
            exposed: [
                { type: 'CHI', cards: makeChi(VEG_SUITE_2) }
            ],
            activeCard: new Card(getNextId(), VEG_SUITE_2, 1),
            expected: false
        },
        {
            name: "[RULE-PENG-IMMUTABLE] Exposed PENG scores 3 Fu (not 6 Fu as SAO) and cannot reach 10-Fu threshold on 7-Fu hand",
            hand: [
                ...makeKou(MEAT_SUITE_2, 0, 1), // 2 Fu
                ...makeKou(MEAT_SUITE_3, 0, 1), // 2 Fu
                ...makeChi(MEAT_SUITE_1),       // 3 Fu
                ...makeChi(VEG_SUITE_1),        // 0 Fu
                ...makeChi(VEG_SUITE_2)         // 0 Fu -> hand is 7 Fu + exposed PENG 3 Fu = 10 Fu (exact-10!)
            ],
            exposed: [
                { type: 'PENG', cards: makeTrip(VEG_SUITE_3, 0) } // Veggie PENG = 2 Fu -> 7 + 2 = 9 Fu < 10! (Would be 11 if mis-scored as SAO)
            ],
            activeCard: null,
            expected: false
        },
        {
            name: "[RULE-MELD-UPGRADE-TWO-DRAGONS] Valid 16-card Harmony with TWO-DRAGONS-TUSSLING (9) + 1 CHI (3) + 2 KOU (4)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1), // 2 cards
                ...makeKou(MEAT_SUITE_2, 0, 1), // 2 cards
                ...makeChi(VEG_SUITE_1)         // 3 cards
            ],
            exposed: [
                {
                    type: 'TWO-DRAGONS-TUSSLING',
                    cards: [
                        ...makeQuad(VEG_SUITE_2, 0),
                        new Card(getNextId(), VEG_SUITE_2, 1),
                        ...makeQuad(VEG_SUITE_2, 2)
                    ],
                    quadTypes: ['KAI-ZAO', 'KAI-ZAO']
                }
            ],
            activeCard: null,
            expected: true
        },
        {
            name: "[RULE-HARMONY-EXACT-2-KOU] TWO-DRAGONS-TUSSLING does NOT count as a KOU",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1), // Only 1 KOU!
                ...makeChi(VEG_SUITE_1),
                new Card(getNextId(), VEG_SUITE_3, 0),
                new Card(getNextId(), VEG_SUITE_3, 0) // Not a KOU
            ],
            exposed: [
                {
                    type: 'TWO-DRAGONS-TUSSLING',
                    cards: [
                        ...makeQuad(VEG_SUITE_2, 0),
                        new Card(getNextId(), VEG_SUITE_2, 1),
                        ...makeQuad(VEG_SUITE_2, 2)
                    ]
                }
            ],
            activeCard: null,
            expected: false
        }
    ];

    let allPassed = true;
    testCases.forEach(tc => {
        const canDeclare = Rules.canDeclareHarmony(tc.hand, tc.exposed || [], tc.activeCard);
        if (canDeclare === tc.expected) {
            console.log(`✅ ${tc.name}: Passed`);
        } else {
            console.error(`❌ ${tc.name}: Failed`);
            console.error(`   Expected: ${tc.expected}`);
            console.error(`   Got:      ${canDeclare}`);
            allPassed = false;
        }
    });

    // Issue #25: two 丘, two 乙, two 几, plus a claimed 几, must become PENG + two 丘乙 KOU.
    // Splitting the three 几 across a CHI and two KOU is not a legal partition.
    {
        const hand = [
            new Card(getNextId(), MEAT_SUITE_2, 0),
            new Card(getNextId(), MEAT_SUITE_2, 0),
            new Card(getNextId(), MEAT_SUITE_2, 1),
            new Card(getNextId(), MEAT_SUITE_2, 1),
            new Card(getNextId(), MEAT_SUITE_2, 2),
            new Card(getNextId(), MEAT_SUITE_2, 2),
            ...makeChi(VEG_SUITE_1)
        ];
        const exposed = [
            { type: 'CHI', cards: makeChi(MEAT_SUITE_1) },
            { type: 'CHI', cards: makeChi(6) }
        ];
        const active = new Card(getNextId(), MEAT_SUITE_2, 2);
        const claimed = Rules.assessHarmony(hand, exposed, active, { isSelf: false, isSelfDraw: false });
        const reward = Rules.calculateRewards(hand, exposed, active, { isSelf: false, isSelfDraw: false });
        const peng = claimed && claimed.partition.find(m => m.type === 'PENG');
        const splitChi = claimed && claimed.partition.some(m =>
            m.type === 'CHI' && m.cards[0].suiteIndex === MEAT_SUITE_2
        );
        const kouPairs = claimed ? claimed.partition.filter(m => m.type === 'KOU' && m.cards[0].suiteIndex === MEAT_SUITE_2) : [];
        const claimedOk = claimed
            && claimed.points === 10
            && peng
            && peng.cards.every(c => c.characterIndex === 2)
            && !splitChi
            && kouPairs.length === 2
            && reward.total === 1
            && reward.reasons.length === 1
            && reward.reasons[0] === 'exact-10';
        if (claimedOk) {
            console.log('✅ Issue #25 claimed 几 partitions as PENG + two 丘乙 KOU at exact-10: Passed');
        } else {
            console.error('❌ Issue #25 claimed 几 partitions as PENG + two 丘乙 KOU at exact-10: Failed');
            console.error('   points', claimed && claimed.points, 'reward', reward);
            if (claimed) claimed.partition.forEach(m => console.error('  ', m.type, m.cards.map(c => c.character).join('')));
            allPassed = false;
        }

        const selfAssessed = Rules.assessHarmony(hand, exposed, active, { isSelf: true, isSelfDraw: true });
        const selfDrawn = Rules.calculateRewards(hand, exposed, active, { isSelf: true, isSelfDraw: true });
        const selfSao = selfAssessed && selfAssessed.partition.some(m => m.type === 'SAO' && m.cards.every(c => c.characterIndex === 2));
        if (selfSao && selfDrawn.points === 13 && selfDrawn.total === 1 && selfDrawn.reasons.length === 1 && selfDrawn.reasons[0] === 'self-draw') {
            console.log('✅ Issue #25 self-drawn 几 is SAO (13 Fu, self-draw only): Passed');
        } else {
            console.error('❌ Issue #25 self-drawn 几 is SAO (13 Fu, self-draw only): Failed');
            console.error('   ', selfDrawn);
            allPassed = false;
        }
    }

    // A veggie claimed trip scores 2 Fu as PENG. The old CHI split scored 0 and faked exact-10.
    {
        const hand = [
            ...makeChi(MEAT_SUITE_1),
            ...makeChi(MEAT_SUITE_3),
            new Card(getNextId(), VEG_SUITE_2, 0),
            new Card(getNextId(), VEG_SUITE_2, 0),
            new Card(getNextId(), VEG_SUITE_2, 1),
            new Card(getNextId(), VEG_SUITE_2, 1),
            new Card(getNextId(), VEG_SUITE_2, 2),
            new Card(getNextId(), VEG_SUITE_2, 2)
        ];
        const exposed = [{ type: 'SAO', cards: makeTrip(VEG_SUITE_3, 0) }];
        const active = new Card(getNextId(), VEG_SUITE_2, 2);
        const reward = Rules.calculateRewards(hand, exposed, active, { isSelf: false });
        if (reward.total === 0 && reward.points === 12) {
            console.log('✅ Claimed veggie trip scores as PENG and loses the false exact-10: Passed');
        } else {
            console.error('❌ Claimed veggie trip scores as PENG and loses the false exact-10: Failed');
            console.error('   ', reward);
            allPassed = false;
        }
    }

    // Issue #20: the winning reveal keeps an exposed PENG, labels a claimed 作 as PENG,
    // and labels only the concealed 九九九 as SAO.
    {
        const pengBa = {
            type: 'PENG',
            cards: [card(VEG_SUITE_3, 0), card(VEG_SUITE_3, 0), card(VEG_SUITE_3, 0)]
        };
        const exposed = [
            pengBa,
            { type: 'KOU', cards: [card(VEG_SUITE_2, 0), card(VEG_SUITE_2, 2)] } // 尔生
        ];
        const hand = [
            ...trip(VEG_SUITE_3, 1), // 九九九 concealed
            card(VEG_SUITE_4, 1), card(VEG_SUITE_4, 1), // 作作
            card(VEG_SUITE_5, 0), card(VEG_SUITE_5, 1), card(VEG_SUITE_5, 2), // 可知礼
            card(VEG_SUITE_4, 0), card(VEG_SUITE_4, 2) // 佳仁
        ];
        const active = card(VEG_SUITE_4, 1); // 作 claimed from another player
        const claimed = Rules.assessHarmony(hand, exposed, active, { isSelf: false, isSelfDraw: false });
        const types = (ch, kind) => claimed && claimed.partition.filter(m =>
            m.type === kind && m.cards.every(c => c.character === ch)
        );
        const claimedOk = claimed
            && claimed.points === 8
            && types('八', 'PENG').length === 1
            && types('八', 'SAO').length === 0
            && types('作', 'PENG').length === 1
            && types('作', 'SAO').length === 0
            && types('九', 'SAO').length === 1;
        if (claimedOk) {
            console.log('✅ Issue #20 reveal keeps exposed PENG 八, claimed PENG 作, concealed SAO 九: Passed');
        } else {
            console.error('❌ Issue #20 reveal keeps exposed PENG 八, claimed PENG 作, concealed SAO 九: Failed');
            console.error('   points', claimed && claimed.points);
            if (claimed) claimed.partition.forEach(m => console.error('  ', m.type, m.cards.map(c => c.character).join('')));
            allPassed = false;
        }

        const selfAssessed = Rules.assessHarmony(hand, exposed, active, { isSelf: true, isSelfDraw: true });
        const selfZuo = selfAssessed && selfAssessed.partition.find(m => m.cards.every(c => c.character === '作'));
        const selfBa = selfAssessed && selfAssessed.partition.find(m => m.cards.every(c => c.character === '八'));
        if (selfZuo && selfZuo.type === 'SAO' && selfBa && selfBa.type === 'PENG') {
            console.log('✅ Issue #20 self-drawn 作 is SAO while exposed PENG 八 stays PENG: Passed');
        } else {
            console.error('❌ Issue #20 self-drawn 作 is SAO while exposed PENG 八 stays PENG: Failed');
            if (selfAssessed) selfAssessed.partition.forEach(m => console.error('  ', m.type, m.cards.map(c => c.character).join('')));
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log("All Rules.canDeclareHarmony tests passed successfully!");
    } else {
        process.exit(1);
    }
}

// Run if direct
if (import.meta.url === `file://${process.argv[1]}`) {
    runHarmonyTests();
}
